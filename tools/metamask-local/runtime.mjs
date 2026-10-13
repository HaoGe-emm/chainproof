import { createHardhatRuntimeEnvironment } from "hardhat/hre";
import { createServer } from "node:http";
import { createHash,randomUUID } from "node:crypto";
import { createPublicClient,createWalletClient,custom,keccak256,parseTransaction,defineChain } from "viem";
import { compile } from "../local-evm/compile.mjs";
import { METAMASK_CHAIN_ID,METAMASK_RPC,validateMetaDeployment } from "../../lib/metamask-local-config.ts";
process.env.HARDHAT_DISABLE_TELEMETRY="true";
const allowed=new Set(["eth_chainId","web3_clientVersion","net_version","eth_blockNumber","eth_call","eth_getCode","eth_getLogs","eth_getBlockByNumber","eth_getBlockByHash","eth_getTransactionReceipt","eth_getTransactionByHash","eth_getBalance","eth_getTransactionCount","eth_estimateGas","eth_gasPrice","eth_maxPriorityFeePerGas","eth_feeHistory","eth_sendRawTransaction","eth_syncing"]);
export async function publicRequest(provider,item){
  if(item.method==="eth_accounts")return [];
  if(!allowed.has(item.method))throw Object.assign(new Error("Unlocked account signing and EVM administration are disabled on this RPC"),{code:4100});
  if(item.method==="eth_sendRawTransaction" && Number(parseTransaction(item.params[0]).chainId)!==31338)throw new Error("Wrong Chain ID: only signed local 31338 transactions are accepted");
  return provider.request(item);
}
export const metaTestChain=defineChain({id:31338,name:"MetaMask Local Test",nativeCurrency:{name:"Simulated ETH",symbol:"ETH",decimals:18},rpcUrls:{default:{http:["http://127.0.0.1:18547"]}}});
export async function createMetaNode({port=18547,listen=true}={}){
  if(port!==18547)throw new Error("Only 127.0.0.1:18547 is allowed");
  const hre=await createHardhatRuntimeEnvironment({solidity:"0.8.20",networks:{meta:{type:"edr-simulated",chainType:"l1",chainId:31338,hardfork:"shanghai",loggingEnabled:false,throwOnTransactionFailures:false}}});
  const connection=await hre.network.create("meta"),provider=connection.provider;
  const server=createServer(async(req,res)=>{
    const origin=req.headers.origin;
    if(origin && !["http://127.0.0.1:3006","http://localhost:3006"].includes(origin) && !/^(chrome|moz)-extension:\/\/[a-z0-9-]+$/i.test(origin)){res.writeHead(403);res.end("Local test origin required");return;}
    if(origin)res.setHeader("Access-Control-Allow-Origin",origin);
    if(req.method==="OPTIONS"){res.setHeader("Access-Control-Allow-Methods","POST");res.setHeader("Access-Control-Allow-Headers","Content-Type");res.writeHead(204);res.end();return;}
    if(req.method!=="POST"){res.writeHead(405);res.end();return;}
    let id=null;
    try{
      let text="";for await(const chunk of req){text+=chunk;if(text.length>2000000)throw new Error("Local request too large");}
      const item=JSON.parse(text);id=item?.id ?? null;
      const result=await publicRequest(provider,{method:item.method,params:item.params ?? []});
      res.setHeader("Content-Type","application/json");res.end(JSON.stringify({jsonrpc:"2.0",id,result}));
    }catch(cause){res.setHeader("Content-Type","application/json");res.end(JSON.stringify({jsonrpc:"2.0",id,error:{code:typeof cause.code==="number"?cause.code:-32000,message:cause.message,...(cause.data?{data:cause.data}:{})}}));}
  });
  try{if(listen)await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(port,"127.0.0.1",resolve);});}catch(cause){await connection.close();throw cause;}
  let closed=false;const finished=new Promise(resolve=>server.once("close",resolve));
  const close=async()=>{if(closed)return;closed=true;if(listen)await new Promise(resolve=>server.close(resolve));await connection.close();};
  try{
    const artifacts=await compile(),transport=custom(provider);
    const reader=createPublicClient({chain:metaTestChain,transport}),accounts=await provider.request({method:"eth_accounts"});
    const wallet=createWalletClient({account:accounts[3],chain:metaTestChain,transport}); // Own development deployer, never the user's MetaMask.
    const deploy=async(a,args=[])=>{const tx=await wallet.deployContract({abi:a.abi,bytecode:`0x${a.evm.bytecode.object}`,args});const r=await reader.waitForTransactionReceipt({hash:tx});if(r.status!=="success")throw new Error("Isolated deployment failed");return r;};
    const old=artifacts.contracts["ChainProof.sol"].ChainProof,v2=artifacts.contracts["ChainProofVersionRegistry.sol"].ChainProofVersionRegistry;
    const original=(await deploy(old)).contractAddress,deployed=await deploy(v2,[original]),registry=deployed.contractAddress;
    const samples=[];
    for(let n=1;n<=3;n++){
      const content=`ChainProof MetaMask isolated example ${n}\n`,hash=`0x${createHash("sha256").update(content).digest("hex")}`;
      const tx=await wallet.writeContract({address:original,abi:old.abi,functionName:"registerProof",args:[hash]});if((await reader.waitForTransactionReceipt({hash:tx})).status!=="success")throw new Error("Isolated sample failed");
      samples.push({name:`developer-example-${n}.txt`,hash});
    }
    const successful=async(hash)=>{if((await reader.waitForTransactionReceipt({hash})).status!=="success")throw new Error("Isolated seed transaction reverted");};
    const tx=await wallet.writeContract({address:registry,abi:v2.abi,functionName:"createWork",args:[samples[0].hash]});await successful(tx);
    for(let n=1;n<3;n++){const tx=await wallet.writeContract({address:registry,abi:v2.abi,functionName:"addVersion",args:[BigInt(1),samples[n].hash,BigInt(n)]});await successful(tx);}
    const genesis=await reader.getBlock({blockNumber:BigInt(0)}),block=await reader.getBlock({blockNumber:deployed.blockNumber});
    const manifest=validateMetaDeployment({source:"metamask-local",chainId:METAMASK_CHAIN_ID,rpcUrl:METAMASK_RPC,session:randomUUID(),original,registry,originalCodeHash:keccak256(await reader.getCode({address:original})),registryCodeHash:keccak256(await reader.getCode({address:registry})),genesisHash:genesis.hash,deploymentBlock:String(deployed.blockNumber),deploymentBlockHash:block.hash,funder:accounts[0],seededWorkId:"1",samples});
    return {provider,reader,accounts,artifacts,manifest,close,afterClosed:()=>finished};
  }catch(cause){await close();throw cause;}
}
