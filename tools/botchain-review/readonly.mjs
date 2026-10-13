// Public RPC research: explicit read/simulation allowlist, no wallet or signer.
import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {randomUUID} from "node:crypto";
import {keccak256,getAddress,parseAbi,encodeFunctionData,decodeFunctionResult,encodeDeployData,decodeEventLog} from "viem";
import {compileVariant,variants,experimentDirectory} from "./compile.mjs";
export const OLD=getAddress("0xc64cef65ccd720664cc3bfd7d970b6f866e53052"),HASH="0x8ed3e3e1dc015bd4fe18a80b93adccbd93ea9f7ee7a577600ae6d2e07642f625",TX="0x60e363ce4a5c67b86640f9b8d13122a77b2387a12d736518d34070bac454aafc";
export const ABI=parseAbi(["function getProof(bytes32) view returns(address owner,uint256 timestamp,bool exists)","event ProofRegistered(bytes32 indexed fileHash,address indexed owner,uint256 timestamp)"]);
export const networks=[{name:"mainnet",url:"https://rpc.botchain.ai",id:677},{name:"testnet",url:"https://rpc.bohr.life",id:968}];
const allowed=new Set(["eth_chainId","web3_clientVersion","eth_blockNumber","eth_getCode","eth_getBlockByNumber","eth_getTransactionReceipt","eth_getTransactionByHash","eth_call","eth_estimateGas","eth_feeHistory","eth_gasPrice","eth_maxPriorityFeePerGas","eth_getLogs"]);
export function assertReadRequest(url,method){if(!networks.some(n=>n.url===url)||!allowed.has(method))throw new Error("Only fixed official endpoints and read/simulation methods permitted");}
export function readTransport(network,adapter=null){
  let id=0;const observations=[];
  const request=async(method,params=[])=>{assertReadRequest(network.url,method);const record={method,params,startedAt:new Date().toISOString()},start=performance.now();
    try{let b;const body={jsonrpc:"2.0",id:++id,method,params};if(adapter)b=await adapter(network.url,body);else{const response=await fetch(network.url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),redirect:"error",signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error(`HTTP ${response.status}`);b=await response.json();}if(b.error)throw Object.assign(new Error(b.error.message),{code:b.error.code,data:b.error.data});record.result=b.result;return b.result;}
    catch(cause){record.error={message:cause.message,code:cause.code,data:cause.data,cause:cause.cause?.message};throw cause;}finally{record.ms=performance.now()-start;observations.push(record);}
  };return {request,observations};
}
const attempt=async fn=>{try{return {ok:true,result:await fn()};}catch(cause){return {ok:false,error:cause.message};}};
export async function inspectNetwork(network,adapter=null){
  const t=readTransport(network,adapter),q=t.request,summary={network:network.name,url:network.url,checkedAt:new Date().toISOString(),httpClient:adapter?"Windows system HTTP (normal TLS)":"Node fetch (direct)"};
  try{const identity=await attempt(()=>q("eth_chainId"));summary.identity=identity;if(!identity.ok||Number(identity.result)!==network.id)return {summary,observations:t.observations};
  summary.client=await attempt(()=>q("web3_clientVersion"));const latest=await q("eth_getBlockByNumber",["latest",true]);const head=latest.number;
  summary.head={number:String(BigInt(head)),hash:latest.hash,timestamp:String(BigInt(latest.timestamp)),baseFeePerGas:latest.baseFeePerGas,gasLimit:latest.gasLimit,difficulty:latest.difficulty,withdrawalsRoot:latest.withdrawalsRoot,blobGasUsed:latest.blobGasUsed,excessBlobGas:latest.excessBlobGas,transactionTypes:[...new Set(latest.transactions.map(tx=>tx.type))]};
  summary.blockNumber=await attempt(()=>q("eth_blockNumber"));summary.genesis=await attempt(()=>q("eth_getBlockByNumber",["0x0",false]));summary.safe=await attempt(()=>q("eth_getBlockByNumber",["safe",false]));summary.finalized=await attempt(()=>q("eth_getBlockByNumber",["finalized",false]));
  summary.gasPrice=await attempt(()=>q("eth_gasPrice"));summary.priorityFee=await attempt(()=>q("eth_maxPriorityFeePerGas"));summary.feeHistory=await attempt(()=>q("eth_feeHistory",["0x5",head,[10,50,90]]));
  summary.opcodeCalls={};for(const [name,data] of Object.entries({BASEFEE:"0x4860005260206000f3",PUSH0:"0x5f60005260206000f3",MCOPY:"0x6000600060005e60006000f3",TRANSIENT:"0x600160005d60005c60005260206000f3",BLOBBASEFEE:"0x4a60005260206000f3"}))summary.opcodeCalls[name]=await attempt(()=>q("eth_call",[{data,gas:"0x186a0"},head]));
  summary.sampledBlocks=[];for(let i=1n;i<=4n;i++){const block=await q("eth_getBlockByNumber",[`0x${(BigInt(head)-i).toString(16)}`,true]);summary.sampledBlocks.push({number:block.number,hash:block.hash,timestamp:block.timestamp,baseFeePerGas:block.baseFeePerGas,transactionTypes:[...new Set(block.transactions.map(tx=>tx.type))]});}
  if(network.id===677){
    const code=await q("eth_getCode",[OLD,head]);summary.originalCode={bytes:(code.length-2)/2,keccak256:keccak256(code),metadataTail:code.slice(-110)};
    const proofData=encodeFunctionData({abi:ABI,functionName:"getProof",args:[HASH]}),proof=await q("eth_call",[{to:OLD,data:proofData},head]);summary.proof=decodeFunctionResult({abi:ABI,functionName:"getProof",data:proof});
    summary.absentProof=await attempt(()=>q("eth_call",[{to:OLD,data:encodeFunctionData({abi:ABI,functionName:"getProof",args:[`0x${"0".repeat(64)}`]})},head]));
    const receipt=await q("eth_getTransactionReceipt",[TX]);summary.registration={receipt,transaction:await q("eth_getTransactionByHash",[TX]),events:receipt.logs.filter(l=>l.address.toLowerCase()===OLD.toLowerCase()).map(log=>decodeEventLog({abi:ABI,topics:log.topics,data:log.data}))};
    summary.deployment=await attempt(()=>q("eth_getTransactionReceipt",["0x72bd59f3b4c46176845456310b4cc8a64e8a09bfbec2c6442f6d09e9de4be9c1"]));
    summary.proofGasEstimate=await attempt(()=>q("eth_estimateGas",[{to:OLD,data:proofData}]));
    summary.logs={};const block=BigInt(receipt.blockNumber);for(const span of [1n,100n,10000n,10001n])summary.logs[String(span)]=await attempt(()=>q("eth_getLogs",[{address:OLD,fromBlock:`0x${block.toString(16)}`,toBlock:`0x${(block+span-1n).toString(16)}`,topics:[keccak256(new TextEncoder().encode("ProofRegistered(bytes32,address,uint256)")),HASH]}]));
    summary.simulatedCreation={};for(const name of ["paris-200","shanghai-200"]){const artifact=await compileVariant(variants.find(v=>v.name===name)),c=artifact.contracts["ChainProofVersionRegistry.sol"].ChainProofVersionRegistry,data=encodeDeployData({abi:c.abi,bytecode:`0x${c.evm.bytecode.object}`,args:[OLD]});summary.simulatedCreation[name]=await attempt(async()=>{const result=await q("eth_call",[{data,gas:"0x3d0900"},head]);return {returnedBytes:(result.length-2)/2,runtimeCodeHash:keccak256(result)};});summary.simulatedCreation[`${name}-estimate`]=await attempt(()=>q("eth_estimateGas",[{data,gas:"0x3d0900"}]));}
    summary.recheckedReceipt=await attempt(()=>q("eth_getTransactionReceipt",[TX]));
  }
  return {summary,observations:t.observations};}catch(cause){summary.incomplete=true;summary.error=cause.message;return {summary,observations:t.observations};}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  if(process.argv.slice(2).some(v=>!["--system-http","--mainnet-only"].includes(v)))throw new Error("Only --system-http/--mainnet-only accepted; no endpoint/private-key/deploy arguments");const directory=await experimentDirectory();
  const adapter=process.argv.includes("--system-http")?async(url,body)=>{assertReadRequest(url,body.method);const file=path.join(directory,`request-${randomUUID()}.json`);await writeFile(file,JSON.stringify({url,body}),{flag:"wx"});const {stdout}=await promisify(execFile)("pwsh.exe",["-NoProfile","-NonInteractive","-File",fileURLToPath(new URL("./system-http.ps1",import.meta.url)),"-RequestPath",file],{windowsHide:true,timeout:18000,maxBuffer:4000000});return JSON.parse(stdout.trim());}:null;
  for(const network of networks.filter(n=>!process.argv.includes("--mainnet-only")||n.id===677)){const result=await inspectNetwork(network,adapter);await writeFile(path.join(directory,`${network.name}-readonly.json`),JSON.stringify(result,(_,v)=>typeof v==="bigint"?String(v):v,2),{flag:"wx"});const s=result.summary;console.log(JSON.stringify({directory,network:network.name,identity:s.identity,head:s.head,originalCode:s.originalCode,proof:s.proof,opcodeCalls:s.opcodeCalls,gasPrice:s.gasPrice,simulatedCreation:s.simulatedCreation,error:s.error,incomplete:s.incomplete},(_,v)=>typeof v==="bigint"?String(v):v));}
}
