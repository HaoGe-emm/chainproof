import test,{before,after} from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {writeFile} from "node:fs/promises";
import path from "node:path";
import {createHardhatRuntimeEnvironment} from "hardhat/hre";
import {createPublicClient,createWalletClient,custom,defineChain,encodeDeployData,parseEventLogs,keccak256} from "viem";
import {variants,compileVariant,disassemble,experimentDirectory} from "./compile.mjs";
import {assertReadRequest,networks,OLD} from "./readonly.mjs";
process.env.HARDHAT_DISABLE_TELEMETRY="true";
const artifacts=new Map(),measurements=[];let directory;
before(async()=>{directory=await experimentDirectory();for(const v of variants){const a=await compileVariant(v);artifacts.set(v.name,a);await writeFile(path.join(directory,`${v.name}.json`),JSON.stringify(a,null,2),{flag:"wx"});}});
after(async()=>{await writeFile(path.join(directory,"local-results.json"),JSON.stringify({source:"ISOLATED IN-PROCESS EVM ONLY, NOT BOT DEPLOYMENT",measurements},(_,v)=>typeof v==="bigint"?String(v):v,2),{flag:"wx"});console.log(`COMPATIBILITY_RESULTS ${directory}`);});
async function node(hardfork){const chain=defineChain({id:31339,name:"Compatibility experiment only",nativeCurrency:{name:"Local",symbol:"ETH",decimals:18},rpcUrls:{default:{http:["http://127.0.0.1:18549"]}}});const hre=await createHardhatRuntimeEnvironment({solidity:"0.8.20",networks:{experiment:{type:"edr-simulated",chainType:"l1",chainId:31339,hardfork,loggingEnabled:false,throwOnTransactionFailures:false}}});const c=await hre.network.create("experiment"),transport=custom(c.provider),accounts=await c.provider.request({method:"eth_accounts"});return {provider:c.provider,reader:createPublicClient({chain,transport,pollingInterval:1}),wallet:createWalletClient({account:accounts[0],chain,transport}),other:createWalletClient({account:accounts[1],chain,transport}),accounts,close:()=>c.close()};}
test("disassembly skips PUSH operand bytes rather than searching byte 0x5f",()=>{assert.deepEqual(disassemble("605f5f00").map(i=>i.opcode),[0x60,0x5f,0]);assert.throws(()=>disassemble("615f"),/Truncated/);});
test("public research transport rejects signing, broadcast, reset, unknown methods and alternate URLs",()=>{for(const method of ["eth_sendRawTransaction","eth_sendTransaction","personal_sign","eth_sign","hardhat_reset","debug_traceCall"])assert.throws(()=>assertReadRequest(networks[0].url,method));for(const url of ["http://127.0.0.1:18547","https://rpc.botchain.ai.evil.test","https://other.test"])assert.throws(()=>assertReadRequest(url,"eth_call"));assertReadRequest(networks[0].url,"eth_estimateGas");});
test("research constructor encoding normalizes checksum without changing the original 20-byte address",()=>{const c=artifacts.get("paris-200").contracts["ChainProofVersionRegistry.sol"].ChainProofVersionRegistry;const data=encodeDeployData({abi:c.abi,bytecode:`0x${c.evm.bytecode.object}`,args:[OLD]});assert.equal(OLD.toLowerCase(),"0xc64cef65ccd720664cc3bfd7d970b6f866e53052");assert.equal(data.slice(-40).toLowerCase(),OLD.toLowerCase().slice(2));});
test("Paris has no emitted PUSH0, Shanghai has PUSH0, stable ABI/storage and repeatable bytecode",async()=>{const p=artifacts.get("paris-200"),s=artifacts.get("shanghai-200");assert.equal(p.analysis.constructorPush0+p.analysis.runtimePush0,0);assert.ok(s.analysis.constructorPush0>0&&s.analysis.runtimePush0>0);const contract=a=>a.contracts["ChainProofVersionRegistry.sol"].ChainProofVersionRegistry;assert.deepEqual(contract(p).abi,contract(s).abi);assert.deepEqual(contract(p).storageLayout.storage,contract(s).storageLayout.storage);const repeated=await compileVariant(variants[0]);assert.equal(contract(p).evm.bytecode.object,contract(repeated).evm.bytecode.object);});
for(const variant of variants)test(`${variant.name}: real isolated deployment, 100 versions, authorization, ordering and query Gas`,async()=>{
  const e=await node(variant.evmVersion==="paris"?"merge":"shanghai");
  try{
    const a=artifacts.get(variant.name),old=a.contracts["ChainProof.sol"].ChainProof,v2=a.contracts["ChainProofVersionRegistry.sol"].ChainProofVersionRegistry;
    const receipt=async hash=>{const r=await e.reader.waitForTransactionReceipt({hash});assert.equal(r.status,"success");return r;};
    const oldReceipt=await receipt(await e.wallet.deployContract({abi:old.abi,bytecode:`0x${old.evm.bytecode.object}`}));
    const deployed=await receipt(await e.wallet.deployContract({abi:v2.abi,bytecode:`0x${v2.evm.bytecode.object}`,args:[oldReceipt.contractAddress]})),original=oldReceipt.contractAddress,registry=deployed.contractAddress;
    const read=(functionName,args=[])=>e.reader.readContract({address:registry,abi:v2.abi,functionName,args});
    assert.equal((await read("originalRegistry")).toLowerCase(),original.toLowerCase());
    const hashes=Array.from({length:100},(_,n)=>`0x${createHash("sha256").update(`Compatibility version ${n+1}`).digest("hex")}`);
    const gas={};for(let n=0;n<100;n++){
      await receipt(await e.wallet.writeContract({address:original,abi:old.abi,functionName:"registerProof",args:[hashes[n]]}));
      const result=await receipt(await e.wallet.writeContract({address:registry,abi:v2.abi,functionName:n===0?"createWork":"addVersion",args:n===0?[hashes[n]]:[1n,hashes[n],BigInt(n)]}));
      const events=parseEventLogs({abi:v2.abi,eventName:"VersionAdded",logs:result.logs});assert.equal(events.length,1);assert.equal(events[0].args.versionNumber,BigInt(n+1));assert.equal(events[0].args.previousVersionNumber,BigInt(n));
      if([0,1,9,99].includes(n))gas[n+1]=String(result.gasUsed);
    }
    assert.equal(await read("getVersionCount",[1n]),100n);assert.equal((await read("getWork",[1n])).controller.toLowerCase(),e.accounts[0].toLowerCase());
    const before=await read("getVersion",[1n,1n]);
    const denied=await e.other.writeContract({address:registry,abi:v2.abi,functionName:"addVersion",args:[1n,hashes[0],100n],gas:400000n});assert.equal((await e.reader.waitForTransactionReceipt({hash:denied})).status,"reverted");
    for(const args of [[1n,hashes[0],100n],[1n,`0x${"f".repeat(64)}`,100n],[1n,hashes[99],0n]]){
      const hash=await e.wallet.writeContract({address:registry,abi:v2.abi,functionName:"addVersion",args,gas:400000n});assert.equal((await e.reader.waitForTransactionReceipt({hash})).status,"reverted");assert.equal(await read("getVersionCount",[1n]),100n);
    }
    assert.deepEqual(await read("getVersion",[1n,1n]),before);assert.equal(await read("isHashLinked",[1n,hashes[99]]),true);
    const getProof={address:original,abi:old.abi,functionName:"getProof",args:[hashes[0]]};
    const queryGas={getProof:String(await e.reader.estimateContractGas({...getProof,account:e.accounts[0]})),getWork:String(await e.reader.estimateContractGas({address:registry,abi:v2.abi,functionName:"getWork",args:[1n],account:e.accounts[0]})),getVersion:String(await e.reader.estimateContractGas({address:registry,abi:v2.abi,functionName:"getVersion",args:[1n,100n],account:e.accounts[0]}))};
    const start=performance.now();for(let n=91n;n<=100n;n++){const v=await read("getVersion",[1n,n]);await e.reader.readContract({...getProof,args:[v.fileHash]});}const read20CallsMs=performance.now()-start;
    const logStart=performance.now(),logs=await e.reader.getContractEvents({address:registry,abi:v2.abi,eventName:"WorkCreated",args:{controller:e.accounts[0]},fromBlock:0n,toBlock:await e.reader.getBlockNumber({cacheTime:0})});assert.equal(logs.length,1);const scanMs=performance.now()-logStart;
    measurements.push({variant:variant.name,hardfork:variant.evmVersion==="paris"?"merge":"shanghai",analysis:{...a.analysis,constructor:undefined,runtime:undefined},deploymentGasUsed:String(deployed.gasUsed),gasUsed:gas,queryGasEstimates:queryGas,read20CallsMs,indexedWorkScanMs:scanMs,runtimeCodeHash:keccak256(await e.reader.getCode({address:registry})),original,registry});
  }finally{await e.close();}
});
test("Shanghai bytecode fails on pre-Shanghai VM, while Paris runs there",async()=>{const e=await node("merge");try{const p=artifacts.get("paris-200"),s=artifacts.get("shanghai-200"),old=p.contracts["ChainProof.sol"].ChainProof,version=s.contracts["ChainProofVersionRegistry.sol"].ChainProofVersionRegistry;
  const r=await e.reader.waitForTransactionReceipt({hash:await e.wallet.deployContract({abi:old.abi,bytecode:`0x${old.evm.bytecode.object}`})});assert.equal(r.status,"success");const hash=await e.wallet.deployContract({abi:version.abi,bytecode:`0x${version.evm.bytecode.object}`,args:[r.contractAddress],gas:4000000n});assert.equal((await e.reader.waitForTransactionReceipt({hash})).status,"reverted");
}finally{await e.close();}});
