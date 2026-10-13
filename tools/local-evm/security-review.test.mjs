// 4C-1 adversarial review. Own isolated EDR instances only, never the user's running node.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { parseEventLogs } from "viem";
import { runtime, clients } from "./runtime.mjs";
import { compile, root } from "./compile.mjs";
import path from "node:path";

let hre, connection, client, wallet, accounts, old, v2, mocks;
const hash = (value) => `0x${createHash("sha256").update(value).digest("hex")}`;
const zero = `0x${"0".repeat(64)}`;
const fixture = { "AuditRegistry.sol": { content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract AuditRegistry {
  address public owner; uint public mode;
  constructor(address account) { owner = account; }
  function setMode(uint value) external { mode = value; }
  function getProof(bytes32 key) external view returns(address,uint,bool) {
    if(key == bytes32(0)) return(address(0),0,false);
    if(mode == 1) revert("malicious revert");
    if(mode == 2) { assembly { return(0,1) } }
    if(mode == 3) return(owner,0,true);
    if(mode == 4) return(owner,block.timestamp+100000,true);
    if(mode == 5) return(owner,block.timestamp,false);
    if(mode == 6) return(address(0),block.timestamp,true);
    return(owner,block.timestamp,true);
  }
}` } };
before(async () => {
  hre = await runtime(); connection = await hre.network.create("local");
  ({ publicClient: client, wallet } = clients(connection.provider)); accounts = await client.request({ method: "eth_accounts" });
  const result = await compile(fixture); old = result.contracts["ChainProof.sol"].ChainProof;
  v2 = result.contracts["ChainProofVersionRegistry.sol"].ChainProofVersionRegistry; mocks = result.contracts["AuditRegistry.sol"].AuditRegistry;
});
after(async () => { await connection?.close(); });
async function deploy(artifact, args = []) {
  const tx = await wallet(accounts[0]).deployContract({ abi: artifact.abi, bytecode: `0x${artifact.evm.bytecode.object}`, args, gas: BigInt(4000000) });
  const receipt = await client.waitForTransactionReceipt({ hash: tx }); assert.equal(receipt.status, "success"); return receipt.contractAddress;
}
async function send(address, abi, functionName, args, owner = accounts[0]) {
  const tx = await wallet(owner).writeContract({ address, abi, functionName, args, gas: BigInt(700000) });
  return client.waitForTransactionReceipt({ hash: tx });
}
const read = (address, abi, functionName, args = []) => client.readContract({ address, abi, functionName, args });
async function pair() { const original = await deploy(old); return { original, registry: await deploy(v2, [original]) }; }
async function register(original, value, owner = accounts[0]) { assert.equal((await send(original, old.abi, "registerProof", [value], owner)).status, "success"); }

test("direct mined attacks cannot bypass owner/controller/existence/duplicate/parent checks", async () => {
  const { original, registry } = await pair(); const a = hash("audit A"), b = hash("audit B"), c = hash("audit C");
  await register(original, a); await register(original, b, accounts[1]); await register(original, c);
  assert.equal((await send(registry, v2.abi, "createWork", [a])).status, "success");
  const baseline = await read(registry, v2.abi, "getVersion", [BigInt(1), BigInt(1)]);
  for (const [workId, fileHash, previous, who] of [
    [1, a, 1, accounts[1]], [1, b, 1, accounts[1]], [1, b, 1, accounts[0]],
    [1, a, 1, accounts[0]], [999, c, 1, accounts[0]], [1, hash("missing"), 1, accounts[0]],
    [1, zero, 1, accounts[0]], [1, c, 0, accounts[0]], [1, c, 100, accounts[0]],
  ]) {
    const receipt = await send(registry, v2.abi, "addVersion", [BigInt(workId), fileHash, BigInt(previous)], who);
    assert.equal(receipt.status, "reverted"); assert.equal(receipt.logs.length, 0);
    assert.equal(await read(registry, v2.abi, "getVersionCount", [BigInt(1)]), BigInt(1));
    assert.deepEqual(await read(registry, v2.abi, "getVersion", [BigInt(1), BigInt(1)]), baseline);
  }
  await assert.rejects(wallet(accounts[0]).writeContract({ address: registry, abi: v2.abi, functionName: "createWork", args: ["0x1234"] }));
  assert.equal((await send(registry, v2.abi, "createWork", [a])).status, "success", "Authorized cross-work reuse remains allowed");
});

test("two queued real transactions with the same previous number have exactly one winner", async () => {
  const { original, registry } = await pair(); const values = [0, 1, 2].map((n) => hash(`concurrent ${n}`));
  for (const value of values) await register(original, value);
  await send(registry, v2.abi, "createWork", [values[0]]);
  await connection.provider.request({ method: "evm_setAutomine", params: [false] });
  try {
    const nonce = await client.getTransactionCount({ address: accounts[0] });
    const txs = [];
    for (let n = 0; n < 2; n++) txs.push(await wallet(accounts[0]).writeContract({ address: registry, abi: v2.abi, functionName: "addVersion", args: [BigInt(1), values[n + 1], BigInt(1)], nonce: nonce + n, gas: BigInt(700000) }));
    await connection.provider.request({ method: "evm_mine" });
    const receipts = await Promise.all(txs.map((transaction) => client.getTransactionReceipt({ hash: transaction })));
    assert.deepEqual(receipts.map((receipt) => receipt.status), ["success", "reverted"]);
    assert.equal(await read(registry, v2.abi, "getVersionCount", [BigInt(1)]), BigInt(2));
    const entry = await read(registry, v2.abi, "getVersion", [BigInt(1), BigInt(2)]);
    assert.equal(entry.fileHash, values[1]); assert.equal(entry.previousVersionNumber, BigInt(1));
    assert.equal(await read(registry, v2.abi, "isHashLinked", [BigInt(1), values[2]]), false);
  } finally { await connection.provider.request({ method: "evm_setAutomine", params: [true] }); }
});

test("counterexample: compatible malicious registry can forge ownership and future times", async () => {
  const genuine = await deploy(old); const value = hash("not registered in the genuine registry");
  assert.equal((await read(genuine, old.abi, "getProof", [value]))[2], false);
  const dishonest = await deploy(mocks, [accounts[0]]); const registry = await deploy(v2, [dishonest]);
  assert.equal((await send(registry, v2.abi, "createWork", [value])).status, "success", "Interface probe is not identity/truth verification");
  await send(dishonest, mocks.abi, "setMode", [BigInt(4)]);
  const receipt = await send(registry, v2.abi, "addVersion", [BigInt(1), hash("future proof"), BigInt(1)]);
  assert.equal(receipt.status, "success");
  const version = await read(registry, v2.abi, "getVersion", [BigInt(1), BigInt(2)]);
  const proof = await read(dishonest, mocks.abi, "getProof", [version.fileHash]);
  assert.ok(proof[1] > version.associatedAt, "Contract does not enforce registration <= association under malicious dependencies");
});

test("malformed/inconsistent external returns fail without consuming IDs or leaving versions", async () => {
  const original = await deploy(mocks, [accounts[0]]); const registry = await deploy(v2, [original]);
  for (const mode of [1, 2, 3, 5, 6]) {
    await send(original, mocks.abi, "setMode", [BigInt(mode)]);
    const receipt = await send(registry, v2.abi, "createWork", [hash(`bad dependency ${mode}`)]);
    assert.equal(receipt.status, "reverted"); assert.equal(receipt.logs.length, 0); assert.equal(await read(registry, v2.abi, "nextWorkId"), BigInt(1));
  }
});

test("zero bytes32 is rejected when absent but accepted when legitimately registered in old registry", async () => {
  const { original, registry } = await pair();
  assert.equal((await send(registry, v2.abi, "createWork", [zero])).status, "reverted");
  await register(original, zero); assert.equal((await send(registry, v2.abi, "createWork", [zero])).status, "success");
  // This is legacy bytes32 semantics, not proof that anyone supplied a real file.
});

test("multi-account multi-work seeded randomized state machine checks complete histories", async () => {
  const { original, registry } = await pair();
  const proofs = [];
  for (let n = 0; n < 30; n++) { const value = hash(`state-machine ${n}`); const owner = accounts[n % 3]; await register(original, value, owner); proofs.push({ value, owner }); }
  const model = [];
  for (let n = 0; n < 6; n++) {
    const proof = proofs[n]; const receipt = await send(registry, v2.abi, "createWork", [proof.value], proof.owner);
    const id = parseEventLogs({ abi: v2.abi, eventName: "WorkCreated", logs: receipt.logs })[0].args.workId;
    const version = await read(registry, v2.abi, "getVersion", [id, BigInt(1)]);
    model.push({ id, owner: proof.owner, hashes: [proof.value], immutable: [version] });
  }
  let successes = 0, failures = 0;
  for (let seed of [17, 593, 2026]) {
    for (let n = 0; n < 80; n++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const work = model[(seed >>> 3) % model.length]; const proof = proofs[(seed >>> 7) % proofs.length]; const actor = accounts[(seed >>> 13) % 3];
      const previous = seed % 5 === 0 ? work.hashes.length - 1 : work.hashes.length;
      const valid = actor === work.owner && actor === proof.owner && !work.hashes.includes(proof.value) && previous === work.hashes.length;
      const receipt = await send(registry, v2.abi, "addVersion", [work.id, proof.value, BigInt(previous)], actor);
      assert.equal(receipt.status, valid ? "success" : "reverted");
      if (valid) { successes++; work.hashes.push(proof.value); work.immutable.push(await read(registry, v2.abi, "getVersion", [work.id, BigInt(work.hashes.length)])); }
      else { failures++; assert.equal(receipt.logs.length, 0); }
      const state = await read(registry, v2.abi, "getWork", [work.id]); assert.equal(state.controller.toLowerCase(), work.owner.toLowerCase()); assert.equal(state.versionCount, BigInt(work.hashes.length));
    }
  }
  assert.ok(successes > 0 && failures > 0);
  for (const work of model) {
    for (let n = 1; n <= work.hashes.length; n++) { const version = await read(registry, v2.abi, "getVersion", [work.id, BigInt(n)]); assert.deepEqual(version, work.immutable[n - 1]); assert.equal(version.fileHash, work.hashes[n - 1]); assert.equal(version.previousVersionNumber, BigInt(n - 1)); }
    await assert.rejects(read(registry, v2.abi, "getVersion", [work.id, BigInt(work.hashes.length + 1)]));
  }
});

test("100-version real execution measures constant-size writes and paged read cost", async () => {
  const { original, registry } = await pair(); const measurements = {};
  for (let n = 1; n <= 100; n++) {
    const value = hash(`scale ${n}`); await register(original, value);
    const receipt = await send(registry, v2.abi, n === 1 ? "createWork" : "addVersion", n === 1 ? [value] : [BigInt(1), value, BigInt(n - 1)]);
    assert.equal(receipt.status, "success"); if ([1, 2, 10, 100].includes(n)) measurements[n] = receipt.gasUsed.toString();
  }
  assert.equal(await read(registry, v2.abi, "getVersionCount", [BigInt(1)]), BigInt(100));
  const start = performance.now(); for (let n = 91; n <= 100; n++) await read(registry, v2.abi, "getVersion", [BigInt(1), BigInt(n)]);
  const pagedMs = performance.now() - start;
  await mkdir(path.join(root, ".local-evm/review"), { recursive: true });
  await writeFile(path.join(root, ".local-evm/review/scale-gas.json"), JSON.stringify({ chainId: 31337, compiler: "0.8.20", optimizer: 200, evmVersion: "shanghai", measurements, lastTenReadsMs: pagedMs, rpcCallsForFrontendTenVersions: 20 }, null, 2));
  console.log("REVIEW_SCALE_GAS", JSON.stringify(measurements));
  assert.ok(BigInt(measurements[100]) <= BigInt(measurements[2]) + BigInt(2000), "No history-dependent write gas growth");
});

test("local unlocked JSON-RPC accepts cross-origin transactions despite UI confirmation", async () => {
  const server = await hre.network.createServer("local", "127.0.0.1", 0);
  const { port } = await server.listen(); const url = `http://127.0.0.1:${port}`;
  try {
    const call = async (method, params = []) => {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://untrusted-review.invalid" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      return { header: response.headers.get("access-control-allow-origin"), body: await response.json() };
    };
    const list = await call("eth_accounts"); const from = list.body.result[0], to = list.body.result[1];
    const result = await call("eth_sendTransaction", [{ from, to, value: "0x0", gas: "0x5208" }]);
    assert.ok(result.body.result && !result.body.error, "Disposable test RPC accepts writes without app confirmation");
    const receipt = await call("eth_getTransactionReceipt", [result.body.result]); assert.equal(receipt.body.result.status, "0x1");
    console.log("REVIEW_CORS_ALLOW_ORIGIN", result.header);
    assert.ok(result.header === "*" || result.header === "http://untrusted-review.invalid");
  } finally { await server.close(); }
});
