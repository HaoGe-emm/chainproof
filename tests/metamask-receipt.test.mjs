// Load the actual TS browser module with the already-installed compiler. No RPC
// action is invoked: only its pure pending-metadata/receipt functions are tested.
import test from "node:test";
import assert from "node:assert/strict";
import {readFile}from "node:fs/promises";
import ts from "typescript";
import {encodeAbiParameters,encodeEventTopics,parseAbi}from "viem";
let source=await readFile(new URL("../lib/metamask-local-client.ts",import.meta.url),"utf8");
source=source.replace(/from "@\/lib\/([^\"]+)"/g,(_,name)=>`from "${new URL(`../lib/${name}.ts`,import.meta.url).href}"`).replace('from "viem"',`from "${import.meta.resolve("viem")}"`);
const javascript=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const {restorePending,decodeMetaReceipt,allowedMetaWalletMethod}=await import(`data:text/javascript,${encodeURIComponent(javascript)}`);
const owner="0x0000000000000000000000000000000000000011",other="0x0000000000000000000000000000000000000012",registry="0x0000000000000000000000000000000000000013",original="0x0000000000000000000000000000000000000014",hash=`0x${"a".repeat(64)}`;
const cfg={registry,original,genesisHash:`0x${"b".repeat(64)}`};
const pending={chainId:31338,...cfg,owner,transaction:`0x${"c".repeat(64)}`,intent:{kind:"add",hash,workId:"2",previous:"2"}};
const abi=parseAbi(["event VersionAdded(uint256 indexed workId,address indexed controller,bytes32 indexed fileHash,uint256 versionNumber,uint256 previousVersionNumber,uint256 timestamp)"]);
function receipt(values={}){const p={workId:BigInt(2),controller:owner,fileHash:hash,number:BigInt(3),previous:BigInt(2),address:registry,...values};return {status:"success",logs:[{address:p.address,topics:encodeEventTopics({abi,eventName:"VersionAdded",args:{workId:p.workId,controller:p.controller,fileHash:p.fileHash}}),data:encodeAbiParameters([{type:"uint256"},{type:"uint256"},{type:"uint256"}],[p.number,p.previous,BigInt(1700000000)])}]};}
test("pending recovery stays bound to captured owner and exact isolated deployment",()=>{
  assert.equal(restorePending(pending,cfg).owner,owner);
  for(const patch of [{chainId:677},{chainId:31337},{genesisHash:`0x${"d".repeat(64)}`},{registry:other},{original:other},{transaction:"0x1234"}])assert.equal(restorePending({...pending,...patch},cfg),null);
  assert.equal(restorePending({...pending,intent:{...pending.intent,workId:"9".repeat(90)}},cfg),null);
  assert.equal(restorePending({...pending,intent:{...pending.intent,previous:String(BigInt(2)**BigInt(64))}},cfg),null);
});
test("wallet transport allows guarded send only and refuses alternate write/sign/switch methods",()=>{
  assert.ok(allowedMetaWalletMethod("eth_sendTransaction"));assert.ok(allowedMetaWalletMethod("eth_chainId"));
  for(const method of ["wallet_sendTransaction","wallet_sendCalls","eth_sendRawTransaction","personal_sign","eth_sign","wallet_switchEthereumChain"])assert.equal(allowedMetaWalletMethod(method),false);
});
test("replacement reason survives refresh and unknown replacement metadata is refused",()=>{
  assert.equal(restorePending({...pending,replacementReason:"cancelled"},cfg).replacementReason,"cancelled");
  assert.equal(restorePending({...pending,replacementReason:"unknown"},cfg),null);
});
test("receipt only confirms exact successful contract/wallet/Hash/work/number/parent event",()=>{
  assert.equal(decodeMetaReceipt(cfg,pending,receipt()),BigInt(2));
  for(const change of [{address:other},{controller:other},{fileHash:`0x${"e".repeat(64)}`},{workId:BigInt(3)},{number:BigInt(4)},{previous:BigInt(1)}])assert.throws(()=>decodeMetaReceipt(cfg,pending,receipt(change)),/does not match/);
  assert.throws(()=>decodeMetaReceipt(cfg,pending,{...receipt(),status:"reverted"}),/Transaction Reverted/);
});
test("creation requires version one with empty predecessor",()=>{
  const create={...pending,intent:{kind:"create",hash}};
  assert.equal(decodeMetaReceipt(cfg,create,receipt({number:BigInt(1),previous:BigInt(0)})),BigInt(2));
  assert.throws(()=>decodeMetaReceipt(cfg,create,receipt()),/does not match/);
});
