// Real isolated EVM with generated ephemeral Node test signers; NOT MetaMask extension testing.
import test,{before,after} from "node:test";
import assert from "node:assert/strict";
import {createWalletClient,custom,parseEther,keccak256}from "viem";
import {generatePrivateKey,privateKeyToAccount}from "viem/accounts";
import {createMetaNode,publicRequest,metaTestChain}from "./runtime.mjs";
let node,account,other,wallet,otherWallet,old,v2;
const hashes=[1,2,3,4].map(n=>keccak256(`0x0${n}`));
before(async()=>{
  node=await createMetaNode({listen:false});account=privateKeyToAccount(generatePrivateKey());other=privateKeyToAccount(generatePrivateKey());
  const funding=createWalletClient({account:node.accounts[0],chain:metaTestChain,transport:custom(node.provider)});
  for(const target of [account.address,other.address])await funding.sendTransaction({to:target,value:parseEther("2")});
  const transport=custom({request:args=>publicRequest(node.provider,args)});
  wallet=createWalletClient({account,chain:metaTestChain,transport});otherWallet=createWalletClient({account:other,chain:metaTestChain,transport});
  old=node.artifacts.contracts["ChainProof.sol"].ChainProof.abi;v2=node.artifacts.contracts["ChainProofVersionRegistry.sol"].ChainProofVersionRegistry.abi;
});
after(async()=>{await node?.close();});
test("public RPC exposes no unlocked account, signer, reset or admin transaction capability",async()=>{
  assert.deepEqual(await publicRequest(node.provider,{method:"eth_accounts"}),[]);
  for(const method of ["eth_sendTransaction","eth_sign","personal_sign","hardhat_reset","hardhat_setBalance","hardhat_impersonateAccount"])await assert.rejects(publicRequest(node.provider,{method,params:[]}),/disabled/);
});
test("fresh 31338 addresses and developer work are independent of old 31337",async()=>{
  assert.equal(await node.reader.getChainId(),31338);assert.notEqual(node.manifest.original,"0x5fbdb2315678afecb367f032d93f642f64180aa3");assert.notEqual(node.manifest.registry,"0xe7f1725e7734ce288f8367e1bb143e90bb3f0512");
  await assert.rejects(node.reader.readContract({address:node.manifest.registry,abi:v2,functionName:"getWork",args:[BigInt(4)]}));
});
test("actual signed raw local transactions register own files, create and append with receipt events",async()=>{
  for(const hash of hashes.slice(0,3)){const tx=await wallet.writeContract({address:node.manifest.original,abi:old,functionName:"registerProof",args:[hash]});assert.equal((await node.reader.getTransactionReceipt({hash:tx})).status,"success");}
  let tx=await wallet.writeContract({address:node.manifest.registry,abi:v2,functionName:"createWork",args:[hashes[0]]});assert.equal((await node.reader.getTransactionReceipt({hash:tx})).status,"success");
  for(let n=1;n<3;n++){tx=await wallet.writeContract({address:node.manifest.registry,abi:v2,functionName:"addVersion",args:[BigInt(2),hashes[n],BigInt(n)]});assert.equal((await node.reader.getTransactionReceipt({hash:tx})).status,"success");}
  const work=await node.reader.readContract({address:node.manifest.registry,abi:v2,functionName:"getWork",args:[BigInt(2)]});assert.equal(work.controller.toLowerCase(),account.address.toLowerCase());assert.equal(work.versionCount,BigInt(3));
  for(let n=1;n<=3;n++){const version=await node.reader.readContract({address:node.manifest.registry,abi:v2,functionName:"getVersion",args:[BigInt(2),BigInt(n)]});assert.equal(version.previousVersionNumber,BigInt(n-1));}
});
test("other signer cannot append even its own registered Hash, duplicates revert atomically",async()=>{
  await otherWallet.writeContract({address:node.manifest.original,abi:old,functionName:"registerProof",args:[hashes[3]]});
  for(const [sender,hash]of [[otherWallet,hashes[3]],[wallet,hashes[0]]]){const tx=await sender.writeContract({address:node.manifest.registry,abi:v2,functionName:"addVersion",args:[BigInt(2),hash,BigInt(3)],gas:BigInt(500000)});assert.equal((await node.reader.getTransactionReceipt({hash:tx})).status,"reverted");}
  assert.equal(await node.reader.readContract({address:node.manifest.registry,abi:v2,functionName:"getVersionCount",args:[BigInt(2)]}),BigInt(3));
});
test("raw signed wrong-chain transaction is rejected before execution",async()=>{
  const raw=await account.signTransaction({chainId:677,to:other.address,value:BigInt(0),nonce:50,gas:BigInt(21000),gasPrice:BigInt(1000000000),type:"legacy"});
  await assert.rejects(publicRequest(node.provider,{method:"eth_sendRawTransaction",params:[raw]}),/Wrong Chain/);
});
test("actual repriced pending transaction retains calldata/owner and produces one added version",async()=>{
  const hash=keccak256("0x05");await wallet.writeContract({address:node.manifest.original,abi:old,functionName:"registerProof",args:[hash]});
  await node.provider.request({method:"evm_setAutomine",params:[false]});
  try{
    const nonce=await node.reader.getTransactionCount({address:account.address,blockTag:"pending"});
    const args={address:node.manifest.registry,abi:v2,functionName:"addVersion",args:[BigInt(2),hash,BigInt(3)],nonce,gas:BigInt(200000)};
    const first=await wallet.writeContract({...args,maxFeePerGas:BigInt(20000000000),maxPriorityFeePerGas:BigInt(2000000000)});
    let reason;const waiting=node.reader.waitForTransactionReceipt({hash:first,timeout:15000,pollingInterval:100,onReplaced:value=>{reason=value.reason;}});
    await new Promise(resolve=>setTimeout(resolve,200));
    const replacement=await wallet.writeContract({...args,maxFeePerGas:BigInt(30000000000),maxPriorityFeePerGas:BigInt(3000000000)});
    await node.provider.request({method:"evm_mine",params:[]});const receipt=await waiting;
    assert.equal(receipt.transactionHash,replacement);assert.equal(receipt.status,"success");assert.equal(reason,"repriced");
    assert.equal(await node.reader.readContract({address:node.manifest.registry,abi:v2,functionName:"getVersionCount",args:[BigInt(2)]}),BigInt(4));
  }finally{await node.provider.request({method:"evm_setAutomine",params:[true]});}
});
