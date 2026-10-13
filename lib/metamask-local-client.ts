import { createPublicClient, createWalletClient, defineChain, http, custom, keccak256, encodeFunctionData, parseAbi, parseEventLogs, type Address, type Hex, type TransactionReceipt } from "viem";
import { versionRegistryAbi } from "@/lib/version-registry-abi";
import { METAMASK_CHAIN_ID, METAMASK_RPC, validateMetaDeployment, type MetaDeployment } from "@/lib/metamask-local-config";
import { LocalWalletSession,errorCode,walletMessage } from "@/lib/metamask-local-session";
import { fetchProofLogsAdaptive, nextLogRange } from "@/lib/proof-history";
export const metaChain = defineChain({ id: METAMASK_CHAIN_ID, name: "ChainProof MetaMask Local Test", nativeCurrency: { name: "Simulated Local ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [METAMASK_RPC] } } });
export const metaReader = createPublicClient({ chain: metaChain, transport: http(METAMASK_RPC, { retryCount: 0, timeout: 4000 }), pollingInterval: 300 });
export const originalAbi = parseAbi(["function getProof(bytes32 fileHash) view returns(address owner,uint256 timestamp,bool exists)", "function registerProof(bytes32 fileHash)", "event ProofRegistered(bytes32 indexed fileHash,address indexed owner,uint256 timestamp)"]);
const writeAbi = [...originalAbi,...versionRegistryAbi] as const;
const events = parseAbi(["event WorkCreated(uint256 indexed workId,address indexed controller,bytes32 fileHash,uint256 versionNumber,uint256 timestamp)","event VersionAdded(uint256 indexed workId,address indexed controller,bytes32 indexed fileHash,uint256 versionNumber,uint256 previousVersionNumber,uint256 timestamp)"]);
export type MetaIntent = { kind: "register"; hash: Hex } | { kind: "create"; hash: Hex } | { kind: "add"; hash: Hex; workId: string; previous: string };
export type PendingMeta = { chainId: 31338; genesisHash: Hex; registry: Address; original: Address; owner: Address; transaction: Hex; intent: MetaIntent; replacementReason?: "repriced" | "replaced" | "cancelled" };
export function pendingKey(config: MetaDeployment) { return `chainproof:metamask-local:${config.genesisHash}:${config.registry}`; }
export function restorePending(value: unknown, config: MetaDeployment): PendingMeta | null {
  const p = value as PendingMeta;
  if(p?.replacementReason && !["repriced","replaced","cancelled"].includes(p.replacementReason))return null;
  if(p?.intent?.kind==="add" && (!/^[1-9][0-9]{0,77}$/.test(p.intent.workId) || !/^[1-9][0-9]{0,19}$/.test(p.intent.previous) || BigInt(p.intent.workId)>=BigInt(2)**BigInt(256) || BigInt(p.intent.previous)>=BigInt(2)**BigInt(64)))return null;
  if (!p || p.chainId !== 31338 || p.genesisHash !== config.genesisHash || p.registry !== config.registry || p.original !== config.original || !/^0x[0-9a-fA-F]{40}$/.test(p.owner) || !/^0x[0-9a-fA-F]{64}$/.test(p.transaction) || !/^0x[0-9a-fA-F]{64}$/.test(p.intent?.hash) || !["register","create","add"].includes(p.intent.kind) || (p.intent.kind === "add" && (!/^[1-9][0-9]*$/.test(p.intent.workId) || !/^[1-9][0-9]*$/.test(p.intent.previous)))) return null;
  return p;
}
export async function checkMetaDeployment(config: MetaDeployment) {
  validateMetaDeployment(config);
  if (await metaReader.getChainId() !== METAMASK_CHAIN_ID) throw new Error("Wrong Network");
  const [original,registry,genesis] = await Promise.all([metaReader.getCode({address:config.original}),metaReader.getCode({address:config.registry}),metaReader.getBlock({blockNumber:BigInt(0)})]);
  if (!original || original === "0x" || !registry || registry === "0x") throw new Error("Contract Not Found");
  const block = await metaReader.getBlock({blockNumber:BigInt(config.deploymentBlock)});
  if (keccak256(original) !== config.originalCodeHash || keccak256(registry) !== config.registryCodeHash || genesis.hash !== config.genesisHash || block.hash !== config.deploymentBlockHash || (await metaReader.readContract({address:config.registry,abi:versionRegistryAbi,functionName:"originalRegistry"})).toLowerCase() !== config.original.toLowerCase()) throw new Error("Incorrect Local Configuration");
}
export const metaProof = (config: MetaDeployment,hash:Hex) => metaReader.readContract({address:config.original,abi:originalAbi,functionName:"getProof",args:[hash]});
export const metaWork = (config:MetaDeployment,id:bigint) => metaReader.readContract({address:config.registry,abi:versionRegistryAbi,functionName:"getWork",args:[id]});
export async function metaVersions(config:MetaDeployment,id:bigint,from:bigint,count:bigint,controller:Address) {
  const result=[];
  for(let number=from;number<=count && number<from+BigInt(10);number++){
    const v=await metaReader.readContract({address:config.registry,abi:versionRegistryAbi,functionName:"getVersion",args:[id,number]});
    const [owner,registeredAt,exists]=await metaProof(config,v.fileHash);
    if(!exists || owner.toLowerCase()!==controller.toLowerCase() || registeredAt===BigInt(0) || registeredAt>v.associatedAt || v.previousVersionNumber!==number-BigInt(1)) throw new Error("Incorrect Local Configuration");
    result.push({number,...v,owner,registeredAt});
  }
  return result;
}
export async function scanMetaWorks(config:MetaDeployment,owner:Address,stop:()=>boolean,publish:(ids:bigint[],block:bigint)=>void){
  await checkMetaDeployment(config);let cursor=await metaReader.getBlockNumber({cacheTime:0});const seen=new Set<string>();
  while(!stop()){
    const range=nextLogRange(cursor,BigInt(config.deploymentBlock),BigInt(500));if(!range)return true;
    const logs=await fetchProofLogsAdaptive((fromBlock,toBlock)=>metaReader.getContractEvents({address:config.registry,abi:events,eventName:"WorkCreated",args:{controller:owner},fromBlock,toBlock,strict:true}),range.fromBlock,range.toBlock,{shouldStop:stop});
    if(stop())return false;
    const ids=logs.filter(l=>!l.removed && l.address.toLowerCase()===config.registry.toLowerCase() && l.args.controller?.toLowerCase()===owner.toLowerCase()).sort((a,b)=>a.blockNumber===b.blockNumber?b.logIndex-a.logIndex:a.blockNumber>b.blockNumber?-1:1).map(l=>l.args.workId).filter(id=>{if(seen.has(String(id)))return false;seen.add(String(id));return true;});
    publish(ids,range.fromBlock);cursor=range.nextCursor;
  }
  return false;
}
export function intentCall(config:MetaDeployment,intent:MetaIntent){
  if(intent.kind==="register")return {address:config.original,abi:writeAbi,functionName:"registerProof" as const,args:[intent.hash] as const};
  if(intent.kind==="create")return {address:config.registry,abi:writeAbi,functionName:"createWork" as const,args:[intent.hash] as const};
  return {address:config.registry,abi:writeAbi,functionName:"addVersion" as const,args:[BigInt(intent.workId),intent.hash,BigInt(intent.previous)] as const};
}
export function allowedMetaWalletMethod(method:string){return ["eth_sendTransaction","eth_chainId","eth_accounts","eth_getBlockByNumber","eth_getBlockByHash","eth_getTransactionCount","eth_estimateGas","eth_gasPrice","eth_maxPriorityFeePerGas","eth_feeHistory"].includes(method);}
export async function sendMeta(config:MetaDeployment,session:LocalWalletSession,intent:MetaIntent,stillMounted:()=>boolean){
  const owner=session.state.address,stamp=session.state.revision;if(!owner)throw new Error("Wallet Disconnected");
  await session.assertCurrent(owner,stamp);await checkMetaDeployment(config);
  const call=intentCall(config,intent);const data=encodeFunctionData(call);
  let submissionStarted=false;
  if(call.functionName==="registerProof")await metaReader.simulateContract({...call,account:owner});
  else if(call.functionName==="createWork")await metaReader.simulateContract({...call,account:owner});
  else await metaReader.simulateContract({...call,account:owner});
  const guarded={request:async(args:{method:string;params?:unknown})=>{
    if(!allowedMetaWalletMethod(args.method))throw new Error("Unsupported local wallet action");
    if(args.method==="eth_sendTransaction"){
      await checkMetaDeployment(config);await session.assertCurrent(owner,stamp);
      const [genesis,deployed]=await Promise.all([session.provider.request({method:"eth_getBlockByNumber",params:["0x0",false]}),session.provider.request({method:"eth_getBlockByNumber",params:[`0x${BigInt(config.deploymentBlock).toString(16)}`,false]})]);
      if(genesis?.hash!==config.genesisHash || deployed?.hash!==config.deploymentBlockHash)throw new Error("Incorrect Local Configuration");
      await session.assertCurrent(owner,stamp);
      const tx=(args.params as Record<string,unknown>[])[0];
      if(!stillMounted() || session.state.revision!==stamp || String(tx.from).toLowerCase()!==owner.toLowerCase() || String(tx.to).toLowerCase()!==call.address.toLowerCase() || tx.data!==data)throw new Error("Wallet Changed");
      // Explicit chain tag remains in the extension request; no switch or fallback.
      submissionStarted=true;
      return session.provider.request({method:"eth_sendTransaction",params:[{...tx,chainId:"0x7a6a"}] as never});
    }
    return session.provider.request(args as never);
  }};
  const wallet=createWalletClient({account:owner,chain:metaChain,transport:custom(guarded as never,{retryCount:0})});
  let transaction:Hex;
  try{
    if(call.functionName==="registerProof")transaction=await wallet.writeContract(call);
    else if(call.functionName==="createWork")transaction=await wallet.writeContract(call);
    else transaction=await wallet.writeContract(call);
    if(!/^0x[0-9a-fA-F]{64}$/.test(transaction))throw new Error("No transaction Hash returned");
  }catch(cause){
    if(!submissionStarted || [4001,-32002,4100].includes(errorCode(cause)??0)||walletMessage(cause).startsWith("Insufficient simulated"))throw cause;
    throw Object.assign(new Error("Submission Uncertain"),{unknown:{chainId:31338,genesisHash:config.genesisHash,registry:config.registry,original:config.original,owner,intent}});
  }
  return {chainId:31338 as const,genesisHash:config.genesisHash,registry:config.registry,original:config.original,owner,transaction,intent};
}
export async function confirmMeta(config:MetaDeployment,pending:PendingMeta,onReplaced:(p:PendingMeta,reason:string)=>void){
  if(!restorePending(pending,config))throw new Error("Incorrect Local Configuration");
  await checkMetaDeployment(config);
  let current=pending,replacedReason=pending.replacementReason??"";
  const receipt=await metaReader.waitForTransactionReceipt({hash:pending.transaction,timeout:12000,onReplaced:({reason,transaction})=>{current={...pending,transaction:transaction.hash,replacementReason:reason};replacedReason=reason;onReplaced(current,reason);}});
  const transaction=await metaReader.getTransaction({hash:receipt.transactionHash});
  const call=intentCall(config,pending.intent);
  if(transaction.from.toLowerCase()!==pending.owner.toLowerCase() || transaction.to?.toLowerCase()!==call.address.toLowerCase() || transaction.input!==encodeFunctionData(call) || transaction.chainId!==31338 || transaction.value!==BigInt(0))throw new Error(replacedReason?"Transaction Replaced / Cancelled":"Receipt does not match");
  return {current,receipt,result:decodeMetaReceipt(config,current,receipt)};
}
export function decodeMetaReceipt(config:MetaDeployment,p:PendingMeta,r:Pick<TransactionReceipt,"status"|"logs">){
  if(r.status!=="success")throw new Error("Transaction Reverted");
  if(p.intent.kind==="register"){
    const event=parseEventLogs({abi:originalAbi,eventName:"ProofRegistered",logs:r.logs,strict:true}).find(e=>e.address.toLowerCase()===config.original.toLowerCase() && e.args.owner.toLowerCase()===p.owner.toLowerCase() && e.args.fileHash===p.intent.hash);
    if(!event)throw new Error("Receipt does not match");return null;
  }
  const event=parseEventLogs({abi:events,eventName:"VersionAdded",logs:r.logs,strict:true}).find(e=>e.address.toLowerCase()===config.registry.toLowerCase() && e.args.controller.toLowerCase()===p.owner.toLowerCase() && e.args.fileHash===p.intent.hash);
  if(!event || (p.intent.kind==="create" && (event.args.versionNumber!==BigInt(1)||event.args.previousVersionNumber!==BigInt(0))) || (p.intent.kind==="add" && (event.args.workId!==BigInt(p.intent.workId)||event.args.previousVersionNumber!==BigInt(p.intent.previous)||event.args.versionNumber!==BigInt(p.intent.previous)+BigInt(1))))throw new Error("Receipt does not match");
  return event.args.workId;
}
