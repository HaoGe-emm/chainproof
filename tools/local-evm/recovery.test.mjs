import test from "node:test";
import assert from "node:assert/strict";
import { readFile,mkdir,writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { encodeFunctionData } from "viem";
import path from "node:path";
import { root } from "./compile.mjs";
import { readBackup,validateBackup,saveExclusive,capture,json } from "./backup.mjs";
import { restoreFresh,inspectRestored } from "./recovery.mjs";
import { refuseExistingDeployment } from "./setup-safety.mjs";
const envelope=JSON.parse(await readFile(path.join(root,"tests/fixtures/local-replay-prefix.json"),"utf8"));
const b=validateBackup(envelope);
test("exclusive backup writes validate checksums and never overwrite previous files",async()=>{
  const dir=path.join(root,".local-evm/recovery-tests",`checksum-${randomUUID()}`);
  const a=await saveExclusive(envelope,dir),c=await saveExclusive(envelope,dir);assert.notEqual(a,c);
  assert.equal((await readBackup(a)).versionCount,3);
  await writeFile(c,(await readFile(c,"utf8")).replace('"versionCount": 3','"versionCount": 9'));
  await assert.rejects(readBackup(c),/SHA-256/);
  assert.equal((await readBackup(a)).versionCount,3);
});
test("two fresh-node replays restore storage, all event/transaction/block hashes and survive close/restart",async()=>{
  for(let n=0;n<2;n++){
    const owned=await restoreFresh(b,{port:18546});
    try{
      assert.equal(owned.report.workCount,1);assert.equal(owned.report.versionCount,3);assert.ok(owned.report.allArchivedBlockHashesMatch);
      assert.equal(owned.report.transactionHashesPreserved,10);
      const works=await inspectRestored(owned.request,b);assert.deepEqual(works[0].versions.map(v=>v.previousVersionNumber),["0","1","2"]);
      assert.equal(works[0].controller,b.works[0].controller);
      const call=async(method,params=[])=>{const response=await fetch("http://127.0.0.1:18546",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:8,method,params})});return response.json();};
      const publicRead=await call("eth_call",[{to:b.config.registry,data:encodeFunctionData({abi:b.abis.registry,functionName:"getVersionCount",args:[BigInt(1)]})},"latest"]);
      assert.equal(BigInt(publicRead.result),BigInt(3),"Fresh HTTP reads recover history without wallet or browser storage");
      const denied=await call("hardhat_reset");assert.equal(denied.id,8);assert.ok(denied.error,"Recovered HTTP endpoint refuses reset methods");
      const artifacts={compiler:b.compiler,contracts:{"ChainProof.sol":{ChainProof:{abi:b.abis.original}},"ChainProofVersionRegistry.sol":{ChainProofVersionRegistry:{abi:b.abis.registry}}}};
      const exported=await capture(({method,params})=>owned.request(method,params),b.config,artifacts);
      assert.equal(exported.payload.versionCount,3);assert.equal(exported.payload.proofs.length,5);assert.equal(exported.payload.transactionCount,10);
      await assert.rejects(restoreFresh(b,{port:18546}),/EADDRINUSE|address already in use/);
      assert.deepEqual(await inspectRestored(owned.request,b),works,"A duplicate recovery must not change the already running node");
    }finally{await owned.close();}
  }
});
test("failed replay closes only its fresh node, releases its port and leaves original input unchanged",async()=>{
  const mutated=structuredClone(b);mutated.genesisAccounts[0].balance="0x1";
  await assert.rejects(restoreFresh(mutated,{port:18546}),/Genesis account/);
  const owned=await restoreFresh(b,{port:18546});try{assert.ok(owned.report.allArchivedBlockHashesMatch);}finally{await owned.close();}
  assert.equal(json(validateBackup(envelope)),json(b));
});
test("existing deployment manifests are refused before setup can write",async()=>{
  const dir=path.join(root,".local-evm/recovery-tests",`guard-${randomUUID()}`);await mkdir(dir,{recursive:true});await writeFile(path.join(dir,"deployment.json"),"protected user metadata",{flag:"wx"});
  await assert.rejects(refuseExistingDeployment(dir),/protected/);assert.equal(await readFile(path.join(dir,"deployment.json"),"utf8"),"protected user metadata");
});
