import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateBackup, seal } from "../tools/local-evm/backup.mjs";
import { isolatedPort } from "../tools/local-evm/recovery.mjs";
const fixture=JSON.parse(await readFile(new URL("./fixtures/local-replay-prefix.json",import.meta.url),"utf8"));
test("complete local archive includes all proofs, versions, transactions and events",()=>{
  const b=validateBackup(fixture);assert.equal(b.workCount,1);assert.equal(b.versionCount,3);assert.equal(b.proofs.length,5);assert.equal(b.transactionCount,10);
});
test("byte/Hash corruption is refused before recovery",()=>{
  const b=structuredClone(fixture);b.payload.works[0].versions[0].fileHash=`0x${"f".repeat(64)}`;assert.throws(()=>validateBackup(b),/integrity/);
});
for(const [name,mutate,pattern] of [
  ["wrong Chain ID",b=>{b.chainId=677;},/chain/],
  ["mainnet contract address",b=>{b.config.original="0xC64CEF65ccd720664cc3bfd7D970b6F866E53052";},/contract address/],
  ["incorrect other contract address",b=>{b.config.registry="0x0000000000000000000000000000000000000009";},/event/],
  ["code Hash mismatch",b=>{b.config.registryCodeHash=`0x${"f".repeat(64)}`;},/code Hash/],
  ["abnormal Work count",b=>{b.workCount++;},/Work count/],
  ["abnormal Version count",b=>{b.versionCount++;},/Version total/],
  ["missing version",b=>{b.works[0].versions.pop();},/version count/],
  ["invalid predecessor",b=>{b.works[0].versions[2].previousVersionNumber="0";},/version order/],
  ["incorrect controller",b=>{b.works[0].controller=b.config.accounts[1];},/owner/],
  ["missing unassociated original proof",b=>{b.proofs.pop();},/registrations/],
  ["incomplete block history",b=>{b.blocks.pop();},/block archive/],
  ["missing transaction receipt",b=>{delete b.blocks[1].transactions[0].receipt;},/receipt/],
]) test(`backup validation refuses ${name}`,()=>{const b=structuredClone(fixture.payload);mutate(b);assert.throws(()=>validateBackup(seal(b)),pattern);});
test("isolated recovery cannot target public networks or current port",()=>{
  assert.equal(isolatedPort(18545),18545);
  for(const target of [8545,677,968,0,"https://rpc.botchain.ai","http://127.0.0.1:8545"])assert.throws(()=>isolatedPort(target),/forbidden/);
});
