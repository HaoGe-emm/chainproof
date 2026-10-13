import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { parseEventLogs, encodeFunctionData, keccak256, encodeAbiParameters, toHex, parseAbi } from "viem";
import { readFile } from "node:fs/promises";
import { runtime, clients, assertLocal } from "./runtime.mjs";
import { compile, saveArtifacts } from "./compile.mjs";

let connection, client, wallet, accounts, artifacts, old, v2, original, registry, snapshot;
const hashes = Array.from({ length: 45 }, (_, index) => `0x${createHash("sha256").update(`Local EVM contract test file ${index}`).digest("hex")}`);
const fixtures = { "Adversarial.sol": { content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract BadABI { function hello() external pure returns(uint) { return 1; } }
contract BrokenOriginal {
  uint public mode; address public owner;
  constructor(address initial) { owner = initial; }
  function setMode(uint value) external { mode = value; }
  function getProof(bytes32 hash) external view returns(address,uint,bool) {
    if (hash == bytes32(0)) return(address(0),0,false);
    if(mode == 1) revert("read failed");
    if(mode == 2) { assembly { return(0,1) } }
    if(mode == 3) return(owner,0,true);
    return(owner,block.timestamp,true);
  }
}
contract Forwarder {
  function callTarget(address target, bytes calldata data) external returns(bytes memory) {
    (bool ok, bytes memory result) = target.call(data); require(ok,"forward rejected"); return result;
  }
}
contract StaticMutation {
  uint public counter;
  function getProof(bytes32 hash) external returns(address,uint,bool) {
    if(hash == bytes32(0)) return(address(0),0,false);
    counter++; return(msg.sender,block.timestamp,true);
  }
}` } };
async function deploy(artifact, args = []) {
  const transaction = await wallet(accounts[0]).deployContract({ abi: artifact.abi, bytecode: `0x${artifact.evm.bytecode.object}`, args });
  const receipt = await client.waitForTransactionReceipt({ hash: transaction });
  assert.equal(receipt.status, "success"); return receipt.contractAddress;
}
function read(functionName, args = [], address = registry, abi = v2.abi) { return client.readContract({ address, abi, functionName, args }); }
async function send(functionName, args = [], who = accounts[0], address = registry, abi = v2.abi) {
  const transaction = await wallet(who).writeContract({ address, abi, functionName, args });
  const receipt = await client.waitForTransactionReceipt({ hash: transaction }); assert.equal(receipt.status, "success"); return receipt;
}
async function fails(functionName, args, errorName, who = accounts[0], address = registry, abi = v2.abi) {
  await assert.rejects(client.simulateContract({ address, abi, functionName, args, account: who }), (error) => {
    let current = error; while (current) { if (current.data?.errorName === errorName) return true; current = current.cause; }
    return false;
  }, errorName);
}
before(async () => {
  const hre = await runtime(); connection = await hre.network.create("local");
  ({ publicClient: client, wallet } = clients(connection.provider)); await assertLocal(client);
  accounts = await client.request({ method: "eth_accounts" });
  const result = await compile(fixtures); await saveArtifacts(result); artifacts = result.contracts;
  old = artifacts["ChainProof.sol"].ChainProof; v2 = artifacts["ChainProofVersionRegistry.sol"].ChainProofVersionRegistry;
  original = await deploy(old); registry = await deploy(v2, [original]);
  for (let index = 0; index < hashes.length; index++) await send("registerProof", [hashes[index]], index === 3 ? accounts[1] : accounts[0], original, old.abi);
  snapshot = await connection.provider.request({ method: "evm_snapshot" });
});
beforeEach(async () => { await connection.provider.request({ method: "evm_revert", params: [snapshot] }); snapshot = await connection.provider.request({ method: "evm_snapshot" }); });
after(async () => { await connection?.close(); });

test("atomic work creation binds controller, assigns unique IDs and writes first version/events", async () => {
  const receipt = await send("createWork", [hashes[0]]);
  const work = await read("getWork", [BigInt(1)]); const version = await read("getVersion", [BigInt(1), BigInt(1)]);
  assert.equal(work.controller.toLowerCase(), accounts[0].toLowerCase()); assert.equal(work.versionCount, BigInt(1));
  assert.equal(version.fileHash, hashes[0]); assert.equal(version.previousVersionNumber, BigInt(0)); assert.equal(work.createdAt, version.associatedAt);
  const events = parseEventLogs({ abi: v2.abi, logs: receipt.logs }); assert.equal(events.length, 2);
  assert.equal(events[0].eventName, "WorkCreated"); assert.equal(events[1].eventName, "VersionAdded");
  assert.equal(events[0].args.fileHash, version.fileHash); assert.equal(events[1].args.timestamp, version.associatedAt);
  await send("createWork", [hashes[1]]); assert.equal(await read("nextWorkId"), BigInt(3));
});
test("missing and foreign initial proof revert without consuming IDs or writing partial state", async () => {
  const unknown = `0x${"e".repeat(64)}`;
  await fails("createWork", [unknown], "OriginalProofNotFound");
  await fails("createWork", [hashes[3]], "NotOriginalRegistrant");
  await fails("createWork", [hashes[0]], "NotOriginalRegistrant", accounts[1]);
  assert.equal(await read("nextWorkId"), BigInt(1)); await fails("getWork", [BigInt(1)], "WorkNotFound");
});
test("append versions 2/3 with linear parents; immutable old entries and event integrity", async () => {
  await send("createWork", [hashes[0]]); const first = await read("getVersion", [BigInt(1), BigInt(1)]);
  for (let index = 1; index <= 2; index++) {
    const receipt = await send("addVersion", [BigInt(1), hashes[index], BigInt(index)]);
    const event = parseEventLogs({ abi: v2.abi, logs: receipt.logs })[0];
    const version = await read("getVersion", [BigInt(1), BigInt(index + 1)]);
    assert.equal(event.args.workId, BigInt(1)); assert.equal(event.args.versionNumber, BigInt(index + 1));
    assert.equal(event.args.controller.toLowerCase(), accounts[0].toLowerCase()); assert.equal(event.args.fileHash, version.fileHash);
    assert.equal(version.previousVersionNumber, BigInt(index)); assert.equal(event.args.timestamp, version.associatedAt);
  }
  assert.equal(await read("getVersionCount", [BigInt(1)]), BigInt(3)); assert.deepEqual(await read("getVersion", [BigInt(1), BigInt(1)]), first);
});
test("noncontroller, foreign registration, absent hash and missing work are denied", async () => {
  await send("createWork", [hashes[0]]);
  await fails("addVersion", [BigInt(1), hashes[3], BigInt(1)], "NotController", accounts[1]);
  await fails("addVersion", [BigInt(1), hashes[3], BigInt(1)], "NotOriginalRegistrant");
  await fails("addVersion", [BigInt(1), `0x${"f".repeat(64)}`, BigInt(1)], "OriginalProofNotFound");
  await fails("addVersion", [BigInt(99), hashes[1], BigInt(0)], "WorkNotFound");
  assert.equal(await read("getVersionCount", [BigInt(1)]), BigInt(1)); assert.equal(await read("isHashLinked", [BigInt(1), hashes[1]]), false);
});
test("duplicate per work denied; cross-work reuse by original owner allowed", async () => {
  await send("createWork", [hashes[0]]);
  await fails("addVersion", [BigInt(1), hashes[0], BigInt(1)], "HashAlreadyLinked");
  await send("createWork", [hashes[0]]); assert.equal(await read("isHashLinked", [BigInt(2), hashes[0]]), true);
  await fails("createWork", [hashes[0]], "NotOriginalRegistrant", accounts[1]);
});
test("stale/incorrect head denied atomically; reordering and skipped versions cannot be supplied", async () => {
  await send("createWork", [hashes[0]]);
  for (const previous of [BigInt(0), BigInt(2), BigInt(999)]) await fails("addVersion", [BigInt(1), hashes[1], previous], "UnexpectedPreviousVersion");
  await send("addVersion", [BigInt(1), hashes[1], BigInt(1)]);
  await fails("addVersion", [BigInt(1), hashes[2], BigInt(1)], "UnexpectedPreviousVersion");
  assert.equal(await read("isHashLinked", [BigInt(1), hashes[2]]), false);
  await fails("getVersion", [BigInt(1), BigInt(3)], "VersionOutOfRange");
});
test("public reads reject nonexistent works and out-of-bounds ordinals", async () => {
  for (const name of ["getWork", "getVersionCount"]) await fails(name, [BigInt(0)], "WorkNotFound");
  await fails("isHashLinked", [BigInt(999), hashes[0]], "WorkNotFound");
  await send("createWork", [hashes[0]]);
  for (const number of [BigInt(0), BigInt(2), BigInt(2) ** BigInt(256) - BigInt(1)]) await fails("getVersion", [BigInt(1), number], "VersionOutOfRange");
});
test("mined reverting transactions leave work/version/link state unchanged", async () => {
  await send("createWork", [hashes[0]]);
  const transaction = await wallet(accounts[1]).writeContract({ address: registry, abi: v2.abi, functionName: "addVersion", args: [BigInt(1), hashes[3], BigInt(1)], gas: BigInt(500000) });
  const receipt = await client.waitForTransactionReceipt({ hash: transaction });
  assert.equal(receipt.status, "reverted"); assert.equal(receipt.logs.length, 0);
  assert.equal(await read("getVersionCount", [BigInt(1)]), BigInt(1));
  assert.equal(await read("isHashLinked", [BigInt(1), hashes[3]]), false);
});
test("invalid constructor addresses and wrong ABI are rejected", async () => {
  const bad = await deploy(artifacts["Adversarial.sol"].BadABI);
  for (const address of ["0x0000000000000000000000000000000000000000", accounts[1], bad]) {
    await assert.rejects(wallet(accounts[0]).deployContract({ abi: v2.abi, bytecode: `0x${v2.evm.bytecode.object}`, args: [address] }));
  }
  assert.equal((await read("originalRegistry")).toLowerCase(), original.toLowerCase());
});
test("external registry revert, malformed return and zero timestamp fail safely", async () => {
  const mock = artifacts["Adversarial.sol"].BrokenOriginal;
  const address = await deploy(mock, [accounts[0]]); const target = await deploy(v2, [address]);
  for (const mode of [1, 2, 3]) {
    await send("setMode", [BigInt(mode)], accounts[0], address, mock.abi);
    await assert.rejects(client.simulateContract({ account: accounts[0], address: target, abi: v2.abi, functionName: "createWork", args: [hashes[0]] }));
    assert.equal(await read("nextWorkId", [], target), BigInt(1));
  }
});
test("msg.sender cannot be spoofed by forwarding; STATICCALL cannot mutate registry state", async () => {
  const forward = artifacts["Adversarial.sol"].Forwarder; const proxy = await deploy(forward);
  const data = encodeFunctionData({ abi: v2.abi, functionName: "createWork", args: [hashes[0]] });
  await assert.rejects(client.simulateContract({ account: accounts[0], address: proxy, abi: forward.abi, functionName: "callTarget", args: [registry, data] }));
  const mutator = artifacts["Adversarial.sol"].StaticMutation; const address = await deploy(mutator); const target = await deploy(v2, [address]);
  await assert.rejects(client.simulateContract({ account: accounts[0], address: target, abi: v2.abi, functionName: "createWork", args: [hashes[0]] }));
  assert.equal(await read("counter", [], address, mutator.abi), BigInt(0));
});
test("uint64 version-count boundary cannot wrap or partially append", async () => {
  await send("createWork", [hashes[0]]);
  const mappingSlot = BigInt(v2.storageLayout.storage.find((item) => item.label === "works").slot);
  const workSlot = BigInt(keccak256(encodeAbiParameters([{ type: "uint256" }, { type: "uint256" }], [BigInt(1), mappingSlot])));
  const max = BigInt(2) ** BigInt(64) - BigInt(1);
  // Test-only corruption reaches an otherwise practically unreachable integer boundary.
  await connection.provider.request({ method: "hardhat_setStorageAt", params: [registry, toHex(workSlot + BigInt(1)), toHex(max, { size: 32 })] });
  await fails("addVersion", [BigInt(1), hashes[1], max], "IntegerLimit");
  assert.equal(await read("isHashLinked", [BigInt(1), hashes[1]]), false);
});
test("bounded randomized sequence maintains count/parent/hash/owner invariants across rejected appends", async () => {
  await send("createWork", [hashes[0]]); let number = BigInt(1); let seed = 42;
  const accepted = new Set([hashes[0]]);
  for (let step = 0; step < 60; step++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const index = 1 + seed % 35; const previous = seed % 4 === 0 ? number - BigInt(1) : number;
    const who = seed % 7 === 0 ? accounts[1] : accounts[0];
    const valid = who === accounts[0] && index !== 3 && !accepted.has(hashes[index]) && previous === number;
    if (valid) { await send("addVersion", [BigInt(1), hashes[index], previous], who); accepted.add(hashes[index]); number++; }
    else await assert.rejects(client.simulateContract({ account: who, address: registry, abi: v2.abi, functionName: "addVersion", args: [BigInt(1), hashes[index], previous] }));
    assert.equal(await read("getVersionCount", [BigInt(1)]), number);
  }
  const seen = new Set();
  for (let index = BigInt(1); index <= number; index++) {
    const version = await read("getVersion", [BigInt(1), index]); assert.equal(version.previousVersionNumber, index - BigInt(1)); assert.ok(!seen.has(version.fileHash)); seen.add(version.fileHash);
    const [owner, , exists] = await read("getProof", [version.fileHash], original, old.abi); assert.ok(exists); assert.equal(owner.toLowerCase(), accounts[0].toLowerCase());
  }
});
test("ABI has no edit/delete/admin/signature escape hatches or loops in write paths", async () => {
  const writes = v2.abi.filter((item) => item.type === "function" && ["nonpayable", "payable"].includes(item.stateMutability)).map((item) => item.name).sort();
  assert.deepEqual(writes, ["addVersion", "createWork"]);
  assert.equal(v2.abi.find((item) => item.type === "constructor").inputs.length, 1);
  assert.deepEqual(v2.abi.find((item) => item.name === "createWork").inputs.map((item) => item.type), ["bytes32"]);
  const source = await readFile("contracts/ChainProofVersionRegistry.sol", "utf8");
  assert.ok(!/\b(for|while)\s*\(/.test(source), "Contract contains no unbounded write loops");
});
test("frontend event ABI exactly matches compiled V2 events and old read interface", async () => {
  const source = await readFile("lib/local-version-registry.ts", "utf8");
  const text = source.match(/export const versionEventsAbi = parseAbi\(\[([\s\S]*?)\]\);/)[1];
  const declarations = JSON.parse(`[${text.trim().replace(/,\s*$/, "")}]`);
  const events = parseAbi(declarations);
  const simplify = (event) => ({ name: event.name, inputs: event.inputs.map(({ name, type, indexed }) => ({ name, type, indexed: Boolean(indexed) })) });
  for (const event of events) assert.deepEqual(simplify(event), simplify(v2.abi.find((entry) => entry.type === "event" && entry.name === event.name)));
  const originalRead = old.abi.find((entry) => entry.name === "getProof");
  assert.deepEqual(originalRead.inputs.map((entry) => entry.type), ["bytes32"]);
  assert.deepEqual(originalRead.outputs.map((entry) => entry.type), ["address", "uint256", "bool"]);
});
