// Owns a fresh node only. Never accepts a target RPC/provider or resets a node.
import {createHardhatRuntimeEnvironment} from "hardhat/hre";
import {createServer} from "node:http";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {randomUUID} from "node:crypto";
import path from "node:path";
import {decodeFunctionResult,encodeFunctionData,keccak256} from "viem";
import {readMetaArchive,validateMetaArchive,sealMeta,json} from "./archive.mjs";
import {publicRequest} from "./runtime.mjs";
import {root} from "../local-evm/compile.mjs";
process.env.HARDHAT_DISABLE_TELEMETRY="true";
export function recoveryMetaPort(options={}){
  if(Object.keys(options).some(k=>!["port","resume"].includes(k)))throw new Error("No target RPC/chain overrides accepted");
  const port=options.port??18548;
  if(options.resume===true?port!==18547:port!==18548)throw new Error("Only owned isolated 18548; explicit future resume only uses free 18547");return port;
}
export async function inspectMetaRestored(request,b){
  if(Number(await request("eth_chainId"))!==31338)throw new Error("Wrong restored Chain ID");
  const read=async(which,fn,args=[])=>decodeFunctionResult({abi:b.abis[which],functionName:fn,data:await request("eth_call",[{to:b.config[which],data:encodeFunctionData({abi:b.abis[which],functionName:fn,args})},"latest"])});
  for(const k of ["original","registry"])if(keccak256(await request("eth_getCode",[b.config[k],"latest"]))!==b.config[`${k}CodeHash`])throw new Error("Restored code mismatch");
  if((await read("registry","originalRegistry")).toLowerCase()!==b.config.original.toLowerCase()||await read("registry","nextWorkId")!==BigInt(b.workCount+1))throw new Error("Restored binding/Work count mismatch");
  for(const w of b.works){
    if(json(await read("registry","getWork",[BigInt(w.id)]))!==json({controller:w.controller,createdAt:w.createdAt,versionCount:w.versionCount}))throw new Error(`Restored Work ${w.id} mismatch`);
    for(const v of w.versions){
      if(json(await read("registry","getVersion",[BigInt(w.id),BigInt(v.number)]))!==json({fileHash:v.fileHash,previousVersionNumber:v.previousVersionNumber,associatedAt:v.associatedAt})||json(await read("original","getProof",[v.fileHash]))!==json(v.originalProof)||!await read("registry","isHashLinked",[BigInt(w.id),v.fileHash]))throw new Error(`Restored Version ${w.id}/${v.number} mismatch`);
    }
  }
  for(const p of b.proofs)if(json(await read("original","getProof",[p.fileHash]))!==json([p.owner,p.timestamp,true]))throw new Error("Restored original proof mismatch");
  for(const a of b.accounts)if(await request("eth_getBalance",[a.address,"latest"])!==a.balance||await request("eth_getTransactionCount",[a.address,"latest"])!==a.nonce)throw new Error(`Restored account balance/nonce mismatch: ${a.address}`);
  return b.works;
}
async function replay(request,b){
  if(Number(await request("eth_chainId"))!==31338||await request("eth_blockNumber")!=="0x0")throw new Error("Refusing wrong-chain/nonempty replay target");
  for(const k of ["original","registry"])if(await request("eth_getCode",[b.config[k],"latest"])!=="0x")throw new Error("Refusing existing contracts");
  const genesis=await request("eth_getBlockByNumber",["0x0",false]);
  if(genesis.stateRoot!==b.blocks[0].stateRoot)throw new Error("Genesis state mismatch; no replay attempted");
  for(const a of b.accounts)if(await request("eth_getBalance",[a.address,"0x0"])!==a.genesisBalance||await request("eth_getTransactionCount",[a.address,"0x0"])!==a.genesisNonce)throw new Error("Genesis account mismatch");
  await request("evm_setAutomine",[false]);const mismatches=[];let txCount=0,eventCount=0;
  for(const block of b.blocks.slice(1)){
    await request("evm_setNextBlockTimestamp",[Number(BigInt(block.timestamp))]);await request("hardhat_setNextBlockBaseFeePerGas",[block.baseFeePerGas]);await request("hardhat_setPrevRandao",[block.mixHash]);await request("hardhat_setCoinbase",[block.miner]);await request("evm_setBlockGasLimit",[block.gasLimit]);
    for(const tx of block.transactions)if(await request("eth_sendRawTransaction",[tx.raw])!==tx.hash)throw new Error("Replay transaction Hash mismatch");
    await request("evm_mine",[]);const actual=await request("eth_getBlockByNumber",[block.number,false]);
    if(actual.number!==block.number||actual.timestamp!==block.timestamp||json(actual.transactions)!==json(block.transactions.map(t=>t.hash)))throw new Error("Block time/order mismatch");
    if(actual.hash!==block.hash)mismatches.push({block:String(BigInt(block.number)),expected:block.hash,actual:actual.hash});
    for(const tx of block.transactions){
      const r=await request("eth_getTransactionReceipt",[tx.hash]);const fields=v=>({status:v.status,gasUsed:v.gasUsed,contractAddress:v.contractAddress,blockNumber:v.blockNumber,transactionHash:v.transactionHash,logs:v.logs.map(({address,data,topics,transactionHash,transactionIndex,logIndex,blockNumber})=>({address,data,topics,transactionHash,transactionIndex,logIndex,blockNumber}))});
      if(json(fields(r))!==json(fields(tx.receipt)))throw new Error("Receipt/event mismatch");txCount++;eventCount+=r.logs.length;
    }
  }
  await request("evm_setAutomine",[true]);const works=await inspectMetaRestored(request,b);
  return {source:"ISOLATED 31338 REPLAY ONLY",chainId:31338,restoration:"Signed transaction history replay, not native EVM state import",head:b.head,workCount:works.length,versionCount:b.versionCount,proofCount:b.proofs.length,transactionHashesPreserved:txCount,eventsPreserved:eventCount,allArchivedBlockHashesMatch:genesis.hash===b.blocks[0].hash&&!mismatches.length,blockHashMismatches:mismatches,originalTimestampsPreserved:true,balancesAndNoncesMatch:true,work6:works.find(w=>w.id==="6")};
}
export async function restoreMetaFresh(b,options={}){
  validateMetaArchive(sealMeta(b));const port=recoveryMetaPort(options),g=b.blocks[0];
  const hre=await createHardhatRuntimeEnvironment({solidity:"0.8.20",networks:{meta:{type:"edr-simulated",chainType:"l1",chainId:31338,hardfork:"shanghai",loggingEnabled:false,throwOnTransactionFailures:false,initialDate:new Date(Number(BigInt(g.timestamp))*1000),initialBaseFeePerGas:BigInt(g.baseFeePerGas),blockGasLimit:BigInt(g.gasLimit),allowBlocksWithSameTimestamp:true}}});
  const connection=await hre.network.create("meta"),provider=connection.provider;
  const server=createServer(async(req,res)=>{
    const origin=req.headers.origin;if(origin&&!["http://127.0.0.1:3006","http://localhost:3006"].includes(origin)&&!/^(chrome|moz)-extension:\/\/[a-z0-9-]+$/i.test(origin)){res.writeHead(403);res.end();return;}
    if(origin)res.setHeader("Access-Control-Allow-Origin",origin);
    if(req.method==="OPTIONS"){res.setHeader("Access-Control-Allow-Methods","POST");res.setHeader("Access-Control-Allow-Headers","Content-Type");res.writeHead(204);res.end();return;}
    if(req.method!=="POST"){res.writeHead(405);res.end();return;}let id=null;
    try{let body="";for await(const c of req){body+=c;if(body.length>2000000)throw new Error("Request too large");}const item=JSON.parse(body);id=item?.id??null;const result=await publicRequest(provider,{method:item.method,params:item.params??[]});res.setHeader("Content-Type","application/json");res.end(JSON.stringify({jsonrpc:"2.0",id,result}));}
    catch(cause){res.setHeader("Content-Type","application/json");res.end(JSON.stringify({jsonrpc:"2.0",id,error:{code:typeof cause.code==="number"?cause.code:-32000,message:cause.message,...(cause.data?{data:cause.data}:{})}}));}
  });
  try{await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(port,"127.0.0.1",resolve);});}catch(cause){await connection.close();throw cause;}
  const finished=new Promise(resolve=>server.once("close",resolve));let closed=false;
  const close=async()=>{if(closed)return;closed=true;await new Promise(resolve=>server.close(resolve));await connection.close();};
  const request=(method,params=[])=>provider.request({method,params});
  try{const report=await replay(request,b);if(!report.allArchivedBlockHashesMatch)throw new Error("Exact block history did not match; no silent approximate recovery");return {request,report:{...report,rpc:`http://127.0.0.1:${port}`},close,afterClosed:()=>finished};}catch(cause){await close();throw cause;}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  let owned;
  try{
    const file=process.argv[2];if(!file||process.argv.slice(3).some(a=>!["--apply","--serve"].includes(a)))throw new Error("Usage: recover.mjs BACKUP [--apply] [--serve]; no target RPC/port option");
    const b=await readMetaArchive(file);console.log(json({verified:true,chainId:31338,workCount:b.workCount,versionCount:b.versionCount,head:b.head,dryRun:!process.argv.includes("--apply")}));if(!process.argv.includes("--apply"))process.exit(0);
    const dir=path.join(root,".metamask-local/recovery-tests",`${new Date().toISOString().replace(/[:.]/g,"-")}-${randomUUID().slice(0,8)}`);await mkdir(dir,{recursive:true});
    await writeFile(path.join(dir,"input.json"),await readFile(file),{flag:"wx"});await writeFile(path.join(dir,"input.json.sha256"),await readFile(`${file}.sha256`),{flag:"wx"});
    owned=await restoreMetaFresh(b);await writeFile(path.join(dir,"result.json"),JSON.stringify(owned.report,null,2),{flag:"wx"});console.log(json({reportFile:path.join(dir,"result.json"),...owned.report}));
    if(process.argv.includes("--serve")){process.on("SIGINT",()=>void owned.close());process.on("SIGTERM",()=>void owned.close());await owned.afterClosed();}else await owned.close();
  }catch(cause){if(owned)await owned.close();console.error(`31338 recovery stopped safely: ${cause.shortMessage||cause.message}`);process.exitCode=1;}
}
