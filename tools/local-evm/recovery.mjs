// No target RPC argument: applying recovery always creates and owns a NEW node.
import { createHardhatRuntimeEnvironment } from "hardhat/hre";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { createServer } from "node:http";
import { decodeFunctionResult, encodeFunctionData, keccak256 } from "viem";
import config from "./hardhat.config.mjs";
import { root } from "./compile.mjs";
import { readBackup, validateBackup, seal, json } from "./backup.mjs";
process.env.HARDHAT_DISABLE_TELEMETRY = "true";
export function isolatedPort(port) {
  if (![18545,18546].includes(port)) throw new Error("Recovery may only create a new loopback node on port 18545 or 18546; current 8545/public RPC forbidden");
  return port;
}
export async function inspectRestored(request, b) {
  if (Number(await request("eth_chainId")) !== 31337) throw new Error("Wrong restored Chain ID");
  for(const key of ["original","registry"]) if(keccak256(await request("eth_getCode",[b.config[key],"latest"])) !== b.config[`${key}CodeHash`]) throw new Error("Restored code Hash mismatch");
  const read=async(which,fn,args=[])=>decodeFunctionResult({abi:b.abis[which],functionName:fn,data:await request("eth_call",[{to:b.config[which],data:encodeFunctionData({abi:b.abis[which],functionName:fn,args})},"latest"])});
  if((await read("registry","originalRegistry")).toLowerCase()!==b.config.original.toLowerCase()) throw new Error("Restored original binding mismatch");
  if(await read("registry","nextWorkId")!==BigInt(b.workCount+1)) throw new Error("Restored Work total mismatch");
  const works=[];
  for(const original of b.works) {
    const work=await read("registry","getWork",[BigInt(original.id)]);
    if(json(work)!==json({controller:original.controller,createdAt:original.createdAt,versionCount:original.versionCount})) throw new Error(`Restored Work ${original.id} mismatch`);
    const versions=[];
    for(const expected of original.versions) {
      const version=await read("registry","getVersion",[BigInt(original.id),BigInt(expected.number)]);
      const proof=await read("original","getProof",[expected.fileHash]);
      if(json(version)!==json({fileHash:expected.fileHash,previousVersionNumber:expected.previousVersionNumber,associatedAt:expected.associatedAt}) || json(proof)!==json(expected.originalProof)) throw new Error(`Restored Version ${original.id}/${expected.number} mismatch`);
      if(!await read("registry","isHashLinked",[BigInt(original.id),expected.fileHash])) throw new Error("Restored membership missing");
      versions.push({number:expected.number,...JSON.parse(json(version)),originalProof:JSON.parse(json(proof))});
    }
    works.push({id:original.id,...JSON.parse(json(work)),versions});
  }
  for(const expected of b.proofs) if(json(await read("original","getProof",[expected.fileHash]))!==json([expected.owner,expected.timestamp,true])) throw new Error("Restored original registration mismatch");
  return works;
}
async function replayOnFresh(request,b) {
  if(Number(await request("eth_chainId"))!==31337 || await request("eth_blockNumber")!=="0x0") throw new Error("Recovery refuses a nonempty/wrong-chain node");
  for(const key of ["original","registry"]) if(await request("eth_getCode",[b.config[key],"latest"])!=="0x") throw new Error("Recovery refuses existing contracts");
  const genesis=await request("eth_getBlockByNumber",["0x0",false]);
  if(genesis.stateRoot!==b.blocks[0].stateRoot) throw new Error("Genesis state mismatch; no replay attempted");
  const owned=await request("eth_accounts");
  for(const a of b.genesisAccounts) if(!owned.some((v)=>v.toLowerCase()===a.address.toLowerCase()) || await request("eth_getBalance",[a.address,"0x0"])!==a.balance || await request("eth_getTransactionCount",[a.address,"0x0"])!==a.nonce) throw new Error("Genesis account state mismatch");
  await request("evm_setAutomine",[false]);
  const mismatches=[]; let receipts=0,events=0;
  for(const block of b.blocks.slice(1)) {
    await request("evm_setNextBlockTimestamp",[Number(BigInt(block.timestamp))]);
    await request("hardhat_setNextBlockBaseFeePerGas",[block.baseFeePerGas]);
    await request("hardhat_setPrevRandao",[block.mixHash]);
    await request("hardhat_setCoinbase",[block.miner]);
    await request("evm_setBlockGasLimit",[block.gasLimit]);
    for(const tx of block.transactions) if(await request("eth_sendRawTransaction",[tx.raw])!==tx.hash) throw new Error("Replay transaction Hash changed");
    await request("evm_mine",[]);
    const actual=await request("eth_getBlockByNumber",[block.number,false]);
    if(actual.number!==block.number || actual.timestamp!==block.timestamp || json(actual.transactions)!==json(block.transactions.map((t)=>t.hash))) throw new Error("Replay block number/time/order changed");
    if(actual.hash!==block.hash) mismatches.push({number:String(BigInt(block.number)),expected:block.hash,actual:actual.hash});
    for(const tx of block.transactions) {
      const receipt=await request("eth_getTransactionReceipt",[tx.hash]);
      if(receipt.status!==tx.receipt.status || receipt.gasUsed!==tx.receipt.gasUsed || receipt.contractAddress!==tx.receipt.contractAddress || receipt.blockNumber!==tx.receipt.blockNumber) throw new Error("Replay receipt changed");
      const fields=(logs)=>logs.map(({address,data,topics,transactionHash,transactionIndex,logIndex,blockNumber})=>({address,data,topics,transactionHash,transactionIndex,logIndex,blockNumber}));
      if(json(fields(receipt.logs))!==json(fields(tx.receipt.logs))) throw new Error("Replay events changed");
      receipts++; events+=receipt.logs.length;
    }
  }
  await request("evm_setAutomine",[true]);
  const works=await inspectRestored(request,b);
  return {source:"ISOLATED LOCAL REPLAY ONLY",chainId:31337,restoration:"signed-transaction replay, not native state import",workCount:works.length,versionCount:works.reduce((n,w)=>n+w.versions.length,0),proofCount:b.proofs.length,transactionHashesPreserved:receipts,eventsPreserved:events,originalTimestampsPreserved:true,blockNumbersPreserved:true,genesisHashMatches:genesis.hash===b.blocks[0].hash,blockHashMismatches:mismatches,allArchivedBlockHashesMatch:genesis.hash===b.blocks[0].hash && mismatches.length===0,works};
}
export async function restoreFresh(b,{port=18545,resumeOriginalPort=false}={}) {
  // Validate before starting anything. The caller never supplies an existing RPC/provider.
  validateBackup(seal(b));
  if(resumeOriginalPort) { if(port!==8545) throw new Error("Explicit resume only uses original loopback port"); }
  else isolatedPort(port);
  const genesis=b.blocks[0];
  const local={...config.networks.local,initialDate:new Date(Number(BigInt(genesis.timestamp))*1000),initialBaseFeePerGas:BigInt(genesis.baseFeePerGas),blockGasLimit:BigInt(genesis.gasLimit),allowBlocksWithSameTimestamp:true};
  const hre=await createHardhatRuntimeEnvironment({...config,networks:{local}});
  const connection=await hre.network.create("local");
  // Installed Hardhat's server listen() lacks an error listener. Own the HTTP
  // listener so occupied ports reject safely instead of leaking an EDR instance.
  const methods=new Set(["eth_chainId","web3_clientVersion","net_version","eth_accounts","eth_blockNumber","eth_call","eth_getCode","eth_getLogs","eth_getBlockByNumber","eth_getBlockByHash","eth_getTransactionReceipt","eth_getTransactionByHash","eth_getBalance","eth_getTransactionCount","eth_estimateGas","eth_gasPrice","eth_maxPriorityFeePerGas","eth_feeHistory","eth_sendTransaction","eth_sendRawTransaction"]);
  const server=createServer(async(req,res)=>{
    let requestId=null;
    const origin=req.headers.origin;
    if(origin && !["http://127.0.0.1:3002","http://localhost:3002"].includes(origin)){res.writeHead(403);res.end("Local development origin required");return;}
    if(origin)res.setHeader("Access-Control-Allow-Origin",origin);
    if(req.method==="OPTIONS"){res.setHeader("Access-Control-Allow-Methods","POST");res.setHeader("Access-Control-Allow-Headers","Content-Type");res.writeHead(204);res.end();return;}
    if(req.method!=="POST"){res.writeHead(405);res.end();return;}
    try{
      let body="";for await(const chunk of req){body+=chunk;if(body.length>2000000)throw new Error("Local RPC request too large");}
      const item=JSON.parse(body);
      requestId=item?.id ?? null;
      if(!item || !methods.has(item.method))throw new Error("Method not exposed by recovered development node");
      const result=await connection.provider.request({method:item.method,params:item.params ?? []});
      res.setHeader("Content-Type","application/json");res.end(JSON.stringify({jsonrpc:"2.0",id:item.id,result}));
    }catch(cause){res.setHeader("Content-Type","application/json");res.end(JSON.stringify({jsonrpc:"2.0",id:requestId,error:{code:typeof cause.code==="number"?cause.code:-32000,message:cause.message,...(cause.data?{data:cause.data}:{})}}));}
  });
  try{await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(port,"127.0.0.1",resolve);});}
  catch(cause){await connection.close();throw cause;}
  const url=`http://127.0.0.1:${port}`;
  const request=(method,params=[])=>connection.provider.request({method,params});
  const finished=new Promise(resolve=>server.once("close",resolve));
  let closed=false;
  const close=async()=>{if(closed)return;closed=true;await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));await connection.close();};
  try {
    const report=await replayOnFresh(request,b);
    return {report:{...report,rpc:url},request,close,afterClosed:()=>finished};
  } catch(cause) {await close(); throw cause;}
}
if(process.argv[1]?.endsWith("recovery.mjs")) {
  let owned;
  try {
    const file=process.argv[2]; if(!file) throw new Error("Usage: recovery.mjs BACKUP.json [--apply] [--serve] [--port=18545]. Default is verification only.");
    if(process.argv.slice(3).some((arg)=>!["--apply","--serve","--port=18545","--port=18546"].includes(arg))) throw new Error("Unsupported recovery option. No external RPC or current-node target is accepted.");
    const b=await readBackup(file);
    const port=isolatedPort(Number(process.argv.find((v)=>v.startsWith("--port="))?.split("=")[1] ?? 18545));
    console.log(json({verified:true,workCount:b.workCount,versionCount:b.versionCount,transactions:b.transactionCount,port,dryRun:!process.argv.includes("--apply")}));
    if(!process.argv.includes("--apply")) process.exit(0);
    const dir=path.join(root,".local-evm/recovery-tests",`${new Date().toISOString().replace(/[:.]/g,"-")}-${randomUUID().slice(0,8)}`); await mkdir(dir,{recursive:true});
    await writeFile(path.join(dir,"input-backup.json"),await readFile(file),{flag:"wx"});
    await writeFile(path.join(dir,"input-backup.json.sha256"),await readFile(`${file}.sha256`),{flag:"wx"});
    owned=await restoreFresh(b,{port});
    await writeFile(path.join(dir,"result.json"),JSON.stringify(owned.report,null,2),{flag:"wx"});
    console.log(json({report:path.join(dir,"result.json"),...owned.report,works:undefined}));
    if(process.argv.includes("--serve")) {
      console.log("Recovery owns this fresh loopback node only. Ctrl+C stops it; this does not stop current 8545. State is still in memory.");
      process.on("SIGINT",()=>void owned.close()); process.on("SIGTERM",()=>void owned.close()); await owned.afterClosed();
    } else await owned.close();
  } catch(cause) { if(owned) await owned.close(); console.error(`Recovery stopped safely: ${cause.shortMessage || cause.message}`); process.exitCode=1; }
}
