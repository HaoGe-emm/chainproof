// Allowlisted read-only RPC evidence and local history backup; no keys, signatures or sends.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { encodeFunctionData, decodeFunctionResult, decodeEventLog, parseAbi, keccak256 } from "viem";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true, channel: process.env.CHAINPROOF_BROWSER_CHANNEL || undefined });
const context = await browser.newContext();
const page = await context.newPage();
await page.goto("http://127.0.0.1:3004");
const permitted = new Set(["eth_chainId", "eth_getCode", "eth_getTransactionReceipt", "eth_call", "eth_blockNumber"]);
async function rpc(url, method, params = []) {
  assert.ok(permitted.has(method));
  // Use the browser network stack, as the actual app does (including system proxy).
  const body = await page.evaluate(async ({ url, method, params }) => {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Read-only RPC HTTP ${response.status}`);
    return response.json();
  }, { url, method, params });
  assert.equal(body.error, undefined); return body.result;
}
async function read(url, address, abi, functionName, args = []) {
  return decodeFunctionResult({ abi, functionName, data: await rpc(url, "eth_call", [{ to: address, data: encodeFunctionData({ abi, functionName, args }) }, "latest"]) });
}
const save = (file, value) => writeFile(`.local-evm/review/${file}`, JSON.stringify(value, (_, item) => typeof item === "bigint" ? item.toString() : item, 2));
try {
  await mkdir(".local-evm/review", { recursive: true });
  const legacyAbi = parseAbi(["function getProof(bytes32 fileHash) view returns(address owner,uint256 timestamp,bool exists)", "event ProofRegistered(bytes32 indexed fileHash,address indexed owner,uint256 timestamp)"]);
  const rpcUrl = "https://rpc.botchain.ai", address = "0xC64CEF65ccd720664cc3bfd7D970b6F866E53052";
  const fileHash = "0x8ed3e3e1dc015bd4fe18a80b93adccbd93ea9f7ee7a577600ae6d2e07642f625";
  const transactionHash = "0x60e363ce4a5c67b86640f9b8d13122a77b2387a12d736518d34070bac454aafc";
  const chainId = Number(await rpc(rpcUrl, "eth_chainId")); assert.equal(chainId, 677);
  const code = await rpc(rpcUrl, "eth_getCode", [address, "latest"]); assert.ok(code.length > 2);
  const proof = await read(rpcUrl, address, legacyAbi, "getProof", [fileHash]); assert.equal(proof[2], true);
  assert.equal(proof[0].toLowerCase(), "0x89f415bb42e356e8b892c10b05522e0a8ef151f3");
  const receipt = await rpc(rpcUrl, "eth_getTransactionReceipt", [transactionHash]); assert.equal(receipt.status, "0x1");
  const log = receipt.logs.find((entry) => entry.address.toLowerCase() === address.toLowerCase());
  const event = decodeEventLog({ abi: legacyAbi, data: log.data, topics: log.topics });
  assert.equal(event.args.fileHash, fileHash); assert.equal(event.args.owner.toLowerCase(), proof[0].toLowerCase()); assert.equal(event.args.timestamp, proof[1]);
  await save("mainnet-read-only.json", { observedAt: new Date().toISOString(), source: "BOT Chain Mainnet read-only", rpcUrl, chainId, address, runtimeCodeHash: keccak256(code), fileHash, proof, transactionHash, receiptStatus: receipt.status, blockNumber: BigInt(receipt.blockNumber), event: event.args });
  const config = JSON.parse(await readFile(".local-evm/deployment.json", "utf8"));
  const artifacts = JSON.parse(await readFile(".local-evm/artifacts.json", "utf8"));
  const abi = artifacts.contracts["ChainProofVersionRegistry.sol"].ChainProofVersionRegistry.abi;
  const local = "http://127.0.0.1:8545"; assert.equal(Number(await rpc(local, "eth_chainId")), 31337);
  assert.equal(keccak256(await rpc(local, "eth_getCode", [config.registry, "latest"])), config.registryCodeHash);
  const next = await read(local, config.registry, abi, "nextWorkId"); assert.ok(next < BigInt(10000), "Bounded backup; review a larger node explicitly");
  const works = [];
  for (let id = BigInt(1); id < next; id++) {
    const work = await read(local, config.registry, abi, "getWork", [id]); const versions = [];
    for (let number = BigInt(1); number <= work.versionCount; number++) {
      const version = await read(local, config.registry, abi, "getVersion", [id, number]);
      versions.push({ number, ...version, originalProof: await read(local, config.original, legacyAbi, "getProof", [version.fileHash]) });
    }
    works.push({ id, ...work, versions });
  }
  await save("local-history-snapshot.json", { observedAt: new Date().toISOString(), source: "Historical snapshot of ephemeral LOCAL EVM 31337; NOT MAINNET; not an automatic chain restore", config, works });
  console.log(`PASS: mainnet chain677 known receipt/getProof/event agree; runtime hash ${keccak256(code)}; backed up ${works.length} local works (${works.reduce((sum, work) => sum + work.versions.length, 0)} versions).`);
} finally { await context.close(); await browser.close(); }
