import test,{before} from "node:test";
import assert from "node:assert/strict";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import {decodeFunctionResult,encodeFunctionData} from "viem";
import {createMetaNode} from "./runtime.mjs";
import {captureMeta,sealMeta,validateMetaArchive,saveMetaArchive,readMetaArchive,json} from "./archive.mjs";
import {restoreMetaFresh,recoveryMetaPort,inspectMetaRestored} from "./recover.mjs";
let envelope,b;
before(async()=>{const source=await createMetaNode({listen:false});try{envelope=await captureMeta(args=>source.provider.request(args),source.manifest,source.artifacts);b=validateMetaArchive(envelope);}finally{await source.close();}});
test("complete 31338 export includes raw signed transactions, receipts, proof and predecessor state",()=>{assert.equal(b.chainId,31338);assert.equal(b.workCount,1);assert.equal(b.versionCount,3);assert.equal(b.proofs.length,3);assert.equal(b.blocks.length,9);assert.equal(b.transactionCount,8);assert.deepEqual(b.works[0].versions.map(v=>v.previousVersionNumber),["0","1","2"]);assert.ok(b.blocks.slice(1).every(block=>block.transactions.every(tx=>tx.raw&&tx.receipt)));});
for(const [name,change] of [
  ["wrong Chain ID",v=>v.chainId=31337],
  ["wrong config chain",v=>v.config.chainId=677],
  ["public RPC",v=>v.rpc="https://rpc.botchain.ai"],
  ["mainnet address",v=>v.config.registry="0xC64CEF65ccd720664cc3bfd7D970b6F866E53052"],
  ["wrong local contract address",v=>v.config.registry="0x5fbdb2315678afecb367f032d93f642f64180aa3"],
  ["code Hash mismatch",v=>v.config.registryCodeHash=`0x${"1".repeat(64)}`],
  ["Work count",v=>v.workCount++],
  ["Version count",v=>v.versionCount++],
  ["missing version",v=>v.works[0].versions.pop()],
  ["bad predecessor",v=>v.works[0].versions[1].previousVersionNumber="0"],
  ["wrong controller",v=>v.works[0].controller="0x0000000000000000000000000000000000000001"],
  ["missing receipt",v=>delete v.blocks[1].transactions[0].receipt],
  ["missing block",v=>v.blocks.pop()],
])test(`31338 validation rejects ${name}`,()=>{const altered=structuredClone(b);change(altered);assert.throws(()=>validateMetaArchive(sealMeta(altered)));});
test("byte corruption and missing checksum are detected; exclusive exports preserve old files",async()=>{const dir=`.metamask-local/archive-tests/${randomUUID()}`;const a=await saveMetaArchive(envelope,dir),c=await saveMetaArchive(envelope,dir);assert.notEqual(a.file,c.file);assert.equal((await readMetaArchive(a.file)).workCount,1);const bytes=await readFile(a.file,"utf8");await mkdir(dir,{recursive:true});await writeFile(`${dir}/damaged.json`,bytes.replace('"chainId": 31338','"chainId": 677'),{flag:"wx"});await writeFile(`${dir}/damaged.json.sha256`,await readFile(`${a.file}.sha256`),{flag:"wx"});await assert.rejects(readMetaArchive(`${dir}/damaged.json`),/SHA-256/);await assert.rejects(readMetaArchive(`${dir}/missing.json`));assert.equal(await readFile(a.file,"utf8"),bytes);});
test("recovery cannot target 18547, 8545, public URLs or overridden chains implicitly",()=>{for(const options of [{port:18547},{port:8545},{rpc:"https://rpc.botchain.ai"},{chainId:677},{port:18548,resume:true}])assert.throws(()=>recoveryMetaPort(options));assert.equal(recoveryMetaPort({}),18548);});
test("actual isolated replay preserves block/tx history, storage, balances, refresh reads and duplicate safety",async()=>{for(let attempt=0;attempt<2;attempt++){const restored=await restoreMetaFresh(b);try{assert.ok(restored.report.allArchivedBlockHashesMatch);assert.equal(restored.report.transactionHashesPreserved,8);assert.equal(restored.report.versionCount,3);await inspectMetaRestored(restored.request,b);const response=await fetch("http://127.0.0.1:18548",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"eth_call",params:[{to:b.config.registry,data:encodeFunctionData({abi:b.abis.registry,functionName:"getVersionCount",args:[1n]})},"latest"]})});const rpc=await response.json();assert.equal(decodeFunctionResult({abi:b.abis.registry,functionName:"getVersionCount",data:rpc.result}),3n);await assert.rejects(restoreMetaFresh(b),/EADDRINUSE/);await inspectMetaRestored(restored.request,b);}finally{await restored.close();}}});
test("failed restore releases its own port without changing input or existing chain metadata",async()=>{const altered=structuredClone(b);altered.accounts[0].genesisBalance="0x1";await assert.rejects(restoreMetaFresh(altered),/Genesis account/);const restored=await restoreMetaFresh(b);try{assert.equal(restored.report.workCount,1);}finally{await restored.close();}assert.equal(json(validateMetaArchive(envelope)),json(b));});
