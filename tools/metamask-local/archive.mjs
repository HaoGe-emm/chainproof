// Independent 31338 archive. The stable 31337 format and guards remain unchanged.
import {createHash,randomUUID} from "node:crypto";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {decodeEventLog,encodeFunctionData,decodeFunctionResult,keccak256,serializeTransaction,parseTransaction,http,createPublicClient} from "viem";
import {json,digest} from "../local-evm/backup.mjs";
import {compile,root} from "../local-evm/compile.mjs";
import {validateMetaDeployment,METAMASK_RPC} from "../../lib/metamask-local-config.ts";
export {json};
export const sealMeta=payload=>({format:"chainproof-metamask-replay-v1",sha256:digest(payload),payload});
const hex=(v,size)=>typeof v==="string"&&new RegExp(`^0x[0-9a-fA-F]{${size}}$`).test(v);
const decimal=v=>typeof v==="string"&&/^(0|[1-9][0-9]*)$/.test(v);
export function rawMetaTransaction(t){
  const type=Number(t.type);
  if(![0,1,2].includes(type)||Number(t.chainId)!==31338)throw new Error("Unsupported archived transaction type/chain");
  const tx={type:["legacy","eip2930","eip1559"][type],chainId:31338,nonce:Number(t.nonce),gas:BigInt(t.gas),value:BigInt(t.value),data:t.input,...(t.to?{to:t.to}:{})};
  if(type<2)tx.gasPrice=BigInt(t.gasPrice);else{tx.maxFeePerGas=BigInt(t.maxFeePerGas);tx.maxPriorityFeePerGas=BigInt(t.maxPriorityFeePerGas);}
  if(type>0)tx.accessList=t.accessList;
  const raw=serializeTransaction(tx,{r:t.r,s:t.s,v:BigInt(t.v),...(type>0?{yParity:Number(t.yParity??t.v)}:{})});
  if(keccak256(raw)!==t.hash)throw new Error("Signed transaction Hash mismatch");return raw;
}
export function validateMetaArchive(envelope){
  const fail=message=>{throw new Error(`Invalid 31338 archive: ${message}`);};
  if(envelope?.format!=="chainproof-metamask-replay-v1"||envelope.sha256!==digest(envelope.payload))fail("SHA-256 integrity mismatch");
  const b=envelope.payload;validateMetaDeployment(b.config);
  if(b.chainId!==31338||b.source!=="METAMASK LOCAL TEST ONLY"||b.rpc!==METAMASK_RPC||b.hardhatVersion!=="3.19.0"||b.compiler!=="0.8.20+commit.a1b79de6.Emscripten.clang")fail("wrong chain/source/runtime");
  for(const k of ["original","registry"])if(!hex(b.codes?.[k],(b.codes?.[k]?.length??2)-2)||b.codes[k]==="0x"||keccak256(b.codes[k])!==b.config[`${k}CodeHash`])fail("contract code Hash mismatch");
  if(!Array.isArray(b.works)||b.works.length!==b.workCount||b.workCount<1||b.workCount>1000)fail("Work count");
  const proofs=new Map();
  for(const p of b.proofs??[]){if(!hex(p.fileHash,64)||proofs.has(p.fileHash)||!hex(p.owner,40)||!decimal(p.timestamp)||BigInt(p.timestamp)===0n)fail("missing/duplicate original proof");proofs.set(p.fileHash,p);}
  let total=0;
  for(let i=0;i<b.works.length;i++){
    const w=b.works[i];if(w.id!==String(i+1)||!hex(w.controller,40)||!decimal(w.createdAt)||!decimal(w.versionCount)||!Array.isArray(w.versions)||w.versions.length!==Number(w.versionCount)||!w.versions.length)fail("Work/version count");
    const seen=new Set();for(let n=0;n<w.versions.length;n++){
      const v=w.versions[n],p=proofs.get(v.fileHash);
      if(v.number!==String(n+1)||v.previousVersionNumber!==String(n)||!hex(v.fileHash,64)||seen.has(v.fileHash)||!p||p.owner.toLowerCase()!==w.controller.toLowerCase()||!decimal(v.associatedAt)||BigInt(p.timestamp)>BigInt(v.associatedAt)||(n===0&&v.associatedAt!==w.createdAt))fail("version order/Hash/owner/time");
      if(json(v.originalProof)!==json([p.owner,p.timestamp,true]))fail("original proof cross-check");seen.add(v.fileHash);total++;
    }
  }
  if(total!==b.versionCount||total>10000)fail("Version total");
  if(!decimal(b.head?.number)||!Array.isArray(b.blocks)||b.blocks.length!==Number(b.head.number)+1||b.blocks.length>50000||b.blocks[0].hash!==b.config.genesisHash||b.blocks.at(-1).hash!==b.head.hash||b.blocks[Number(b.config.deploymentBlock)]?.hash!==b.config.deploymentBlockHash)fail("incomplete block archive");
  const txs=new Map(),logs=[];
  for(let i=0;i<b.blocks.length;i++){
    const block=b.blocks[i];if(BigInt(block.number)!==BigInt(i)||(i&&block.parentHash!==b.blocks[i-1].hash)||!Array.isArray(block.transactions))fail("block order");
    for(const tx of block.transactions){
      if(txs.has(tx.hash)||!tx.raw||keccak256(tx.raw)!==tx.hash||Number(parseTransaction(tx.raw).chainId)!==31338||tx.blockHash!==block.hash||tx.receipt?.transactionHash!==tx.hash||tx.receipt?.blockHash!==block.hash||!Array.isArray(tx.receipt.logs))fail("transaction/receipt integrity");
      txs.set(tx.hash,tx);logs.push(...tx.receipt.logs);
    }
  }
  if(txs.size!==b.transactionCount)fail("transaction count");
  const original=logs.filter(l=>l.address.toLowerCase()===b.config.original.toLowerCase());
  const registry=logs.filter(l=>l.address.toLowerCase()===b.config.registry.toLowerCase()).map(log=>({log,event:decodeEventLog({abi:b.abis.registry,topics:log.topics,data:log.data})}));
  if(original.length!==proofs.size||registry.filter(e=>e.event.eventName==="WorkCreated").length!==b.workCount||registry.filter(e=>e.event.eventName==="VersionAdded").length!==b.versionCount)fail("event counts");
  for(const p of proofs.values()){
    const matches=original.filter(l=>l.topics[1]===p.fileHash);if(matches.length!==1)fail("registration event");
    const e=decodeEventLog({abi:b.abis.original,topics:matches[0].topics,data:matches[0].data});
    if(e.eventName!=="ProofRegistered"||e.args.owner.toLowerCase()!==p.owner.toLowerCase()||String(e.args.timestamp)!==p.timestamp||matches[0].transactionHash!==p.transactionHash||String(BigInt(matches[0].blockNumber))!==p.blockNumber)fail("registration event mismatch");
  }
  for(const w of b.works){
    const created=registry.filter(e=>e.event.eventName==="WorkCreated"&&String(e.event.args.workId)===w.id);
    if(created.length!==1||created[0].event.args.controller.toLowerCase()!==w.controller.toLowerCase()||String(created[0].event.args.timestamp)!==w.createdAt||created[0].event.args.fileHash!==w.versions[0].fileHash||String(created[0].event.args.versionNumber)!=="1")fail("work event mismatch");
    for(const v of w.versions){
      const matches=registry.filter(e=>e.event.eventName==="VersionAdded"&&String(e.event.args.workId)===w.id&&String(e.event.args.versionNumber)===v.number);if(matches.length!==1)fail("missing/duplicate version event");
      const {event:e,log}=matches[0];if(e.args.fileHash!==v.fileHash||e.args.controller.toLowerCase()!==w.controller.toLowerCase()||String(e.args.previousVersionNumber)!==v.previousVersionNumber||String(e.args.timestamp)!==v.associatedAt||log.transactionHash!==v.transactionHash||String(BigInt(log.blockNumber))!==v.blockNumber||String(BigInt(log.logIndex))!==v.logIndex)fail("version event mismatch");
    }
  }
  if(!Array.isArray(b.accounts)||b.accounts.some(a=>!hex(a.address,40)||!/^0x[0-9a-f]+$/i.test(a.genesisBalance)||!/^0x[0-9a-f]+$/i.test(a.genesisNonce)||!/^0x[0-9a-f]+$/i.test(a.balance)||!/^0x[0-9a-f]+$/i.test(a.nonce)))fail("account state");
  return b;
}
export async function readMetaArchive(file){
  const bytes=await readFile(file),sum=await readFile(`${file}.sha256`,"utf8");if(sum.split(/\s+/)[0]!==createHash("sha256").update(bytes).digest("hex"))throw new Error("Backup file SHA-256 mismatch");return validateMetaArchive(JSON.parse(bytes));
}
export async function captureMeta(request,config,artifacts){
  validateMetaDeployment(config);
  const allowed=new Set(["eth_chainId","web3_clientVersion","eth_blockNumber","eth_getBlockByNumber","eth_getCode","eth_getTransactionReceipt","eth_call","eth_getBalance","eth_getTransactionCount"]);
  const rpc=(method,params=[])=>{if(!allowed.has(method))throw new Error("Read-only archive RPC required");return request({method,params});};
  if(Number(await rpc("eth_chainId"))!==31338||!(await rpc("web3_clientVersion")).startsWith("HardhatNetwork/3.19.0/"))throw new Error("Wrong local chain/runtime");
  const head=await rpc("eth_blockNumber");if(BigInt(head)>49999n)throw new Error("Explicit review required for large archive");
  const abis={original:artifacts.contracts["ChainProof.sol"].ChainProof.abi,registry:artifacts.contracts["ChainProofVersionRegistry.sol"].ChainProofVersionRegistry.abi};
  const read=async(which,fn,args=[])=>decodeFunctionResult({abi:abis[which],functionName:fn,data:await rpc("eth_call",[{to:config[which],data:encodeFunctionData({abi:abis[which],functionName:fn,args})},head])});
  const codes={original:await rpc("eth_getCode",[config.original,head]),registry:await rpc("eth_getCode",[config.registry,head])};
  for(const k of Object.keys(codes))if(codes[k]==="0x"||keccak256(codes[k])!==config[`${k}CodeHash`])throw new Error("Incorrect deployed code");
  if((await read("registry","originalRegistry")).toLowerCase()!==config.original.toLowerCase())throw new Error("Wrong local registry binding");
  const blocks=[];
  for(let n=0n;n<=BigInt(head);n++){const block=await rpc("eth_getBlockByNumber",[`0x${n.toString(16)}`,true]);for(const tx of block.transactions){tx.raw=rawMetaTransaction(tx);tx.receipt=await rpc("eth_getTransactionReceipt",[tx.hash]);}blocks.push(block);}
  const logs=blocks.flatMap(b=>b.transactions.flatMap(tx=>tx.receipt.logs));
  const proofs=[];
  for(const log of logs.filter(l=>l.address.toLowerCase()===config.original.toLowerCase())){
    const e=decodeEventLog({abi:abis.original,topics:log.topics,data:log.data});if(e.eventName!=="ProofRegistered")throw new Error("Unexpected original event");
    const [owner,timestamp,exists]=await read("original","getProof",[e.args.fileHash]);if(!exists||owner.toLowerCase()!==e.args.owner.toLowerCase()||timestamp!==e.args.timestamp)throw new Error("Original event/storage mismatch");
    proofs.push({fileHash:e.args.fileHash,owner,timestamp:String(timestamp),transactionHash:log.transactionHash,blockNumber:String(BigInt(log.blockNumber))});
  }
  const events=logs.filter(l=>l.address.toLowerCase()===config.registry.toLowerCase()).map(log=>({log,event:decodeEventLog({abi:abis.registry,topics:log.topics,data:log.data})}));
  const next=await read("registry","nextWorkId"),works=[];if(next>1001n)throw new Error("Work export limit exceeded");
  for(let id=1n;id<next;id++){
    const w=await read("registry","getWork",[id]),versions=[];if(w.versionCount>10000n)throw new Error("Version export limit exceeded");
    for(let number=1n;number<=w.versionCount;number++){
      const v=await read("registry","getVersion",[id,number]),entry=events.find(e=>e.event.eventName==="VersionAdded"&&e.event.args.workId===id&&e.event.args.versionNumber===number);if(!entry)throw new Error("Missing version event");
      versions.push({number:String(number),...JSON.parse(json(v)),originalProof:JSON.parse(json(await read("original","getProof",[v.fileHash]))),transactionHash:entry.log.transactionHash,blockNumber:String(BigInt(entry.log.blockNumber)),logIndex:String(BigInt(entry.log.logIndex))});
    }works.push({id:String(id),...JSON.parse(json(w)),versions});
  }
  const touched=new Set([config.funder,config.original,config.registry,...blocks.flatMap(b=>b.transactions.flatMap(tx=>[tx.from,...(tx.to?[tx.to]:[])]))].map(a=>a.toLowerCase()));
  const accounts=[];for(const address of [...touched].sort())accounts.push({address,genesisBalance:await rpc("eth_getBalance",[address,"0x0"]),genesisNonce:await rpc("eth_getTransactionCount",[address,"0x0"]),balance:await rpc("eth_getBalance",[address,head]),nonce:await rpc("eth_getTransactionCount",[address,head])});
  if(await rpc("eth_blockNumber")!==head||(await rpc("eth_getBlockByNumber",[head,false])).hash!==blocks.at(-1).hash)throw new Error("Source chain changed; retry to a new file");
  const pending=await rpc("eth_getBlockByNumber",["pending",false]);if(pending?.transactions?.length)throw new Error("Pending transactions are not backed up; wait before capture");
  const payload={source:"METAMASK LOCAL TEST ONLY",chainId:31338,rpc:METAMASK_RPC,observedAt:new Date().toISOString(),hardhatVersion:"3.19.0",compiler:artifacts.compiler,restoreType:"signed transaction/block replay; not native EVM state dump",config,abis,codes,accounts,head:{number:String(BigInt(head)),hash:blocks.at(-1).hash},workCount:works.length,versionCount:works.reduce((n,w)=>n+w.versions.length,0),transactionCount:blocks.reduce((n,b)=>n+b.transactions.length,0),proofs,works,blocks};
  const envelope=sealMeta(payload);validateMetaArchive(envelope);return envelope;
}
export async function saveMetaArchive(envelope,directory=path.join(root,".local-evm/backups")){
  validateMetaArchive(envelope);await mkdir(directory,{recursive:true});const file=path.join(directory,`chain31338-${new Date().toISOString().replace(/[:.]/g,"-")}-${randomUUID().slice(0,8)}.json`);
  const bytes=JSON.stringify(envelope,null,2);await writeFile(file,bytes,{flag:"wx"});const sha256=createHash("sha256").update(bytes).digest("hex");await writeFile(`${file}.sha256`,`${sha256}  ${path.basename(file)}\n`,{flag:"wx"});return {file,fileSha256:sha256};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  try{
    if(process.argv.length!==2)throw new Error("No RPC/chain/overwrite arguments accepted");
    const config=validateMetaDeployment(JSON.parse(await readFile(path.join(root,".metamask-local/active.json"),"utf8")));
    const reader=createPublicClient({transport:http(METAMASK_RPC,{retryCount:0,timeout:4000,fetchOptions:{redirect:"error"}})});
    const envelope=await captureMeta(args=>reader.request(args),config,await compile());const saved=await saveMetaArchive(envelope),b=envelope.payload;
    console.log(json({...saved,chainId:31338,head:b.head,workCount:b.workCount,versionCount:b.versionCount,proofCount:b.proofs.length,transactions:b.transactionCount,work6:b.works.find(w=>w.id==="6")}));
  }catch(cause){console.error(`Read-only 31338 backup stopped: ${cause.shortMessage||cause.message}`);process.exitCode=1;}
}
