// Read-only capture. No signing, reset, deployment, or state-mutating RPC is reachable here.
import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { decodeEventLog, encodeFunctionData, decodeFunctionResult, keccak256, serializeTransaction, parseTransaction } from "viem";
import { root } from "./compile.mjs";
export const SOURCE_RPC = "http://127.0.0.1:8545";
const MAINNET = "0xc64cef65ccd720664cc3bfd7d970b6f866e53052";
const hex = (v, size) => typeof v === "string" && new RegExp(`^0x[0-9a-fA-F]{${size}}$`).test(v);
const decimal = (v) => typeof v === "string" && /^(0|[1-9][0-9]*)$/.test(v);
export const json = (v) => JSON.stringify(v, (_, n) => typeof n === "bigint" ? n.toString() : n);
export const digest = (v) => createHash("sha256").update(json(v)).digest("hex");
export const seal = (payload) => ({ format: "chainproof-local-replay-v1", sha256: digest(payload), payload });
export function validateBackup(envelope) {
  const fail = (message) => { throw new Error(`Invalid local backup: ${message}`); };
  if (envelope?.format !== "chainproof-local-replay-v1" || envelope.sha256 !== digest(envelope.payload)) fail("SHA-256 integrity mismatch");
  const b = envelope.payload;
  if (b.chainId !== 31337 || b.source !== "LOCAL EVM ONLY" || b.rpc !== SOURCE_RPC || b.hardhatVersion !== "3.19.0" || b.compiler !== "0.8.20+commit.a1b79de6.Emscripten.clang") fail("wrong chain/source/runtime");
  const addresses = [b.config?.original, b.config?.registry];
  if (!addresses.every((v) => hex(v, 40) && !/^0x0{40}$/i.test(v) && v.toLowerCase() !== MAINNET) || addresses[0].toLowerCase() === addresses[1].toLowerCase()) fail("wrong contract address");
  if (b.config.chainId !== 31337 || b.config.rpcUrl !== SOURCE_RPC || b.config.source !== "local-evm") fail("wrong manifest network");
  if (keccak256(b.codes.original) !== b.config.originalCodeHash || keccak256(b.codes.registry) !== b.config.registryCodeHash) fail("contract code Hash mismatch");
  if (!Array.isArray(b.works) || b.works.length !== b.workCount || b.workCount < 1 || b.workCount > 1000) fail("Work count");
  const registered = new Map();
  for (const p of b.proofs ?? []) {
    if (!hex(p.fileHash, 64) || registered.has(p.fileHash) || !hex(p.owner, 40) || !decimal(p.timestamp) || BigInt(p.timestamp) === BigInt(0)) fail("incomplete/duplicate original proof");
    registered.set(p.fileHash, p);
  }
  let count = 0;
  for (let i = 0; i < b.works.length; i++) {
    const work = b.works[i];
    if (work.id !== String(i + 1) || !hex(work.controller, 40) || !decimal(work.createdAt) || !decimal(work.versionCount) || !Array.isArray(work.versions) || work.versions.length !== Number(work.versionCount) || !work.versions.length) fail("incomplete Work/version count");
    const seen = new Set();
    for (let n = 0; n < work.versions.length; n++) {
      const version = work.versions[n], proof = registered.get(version.fileHash);
      if (version.number !== String(n + 1) || version.previousVersionNumber !== String(n) || !hex(version.fileHash, 64) || seen.has(version.fileHash) || !proof || proof.owner.toLowerCase() !== work.controller.toLowerCase() || !decimal(version.associatedAt) || BigInt(proof.timestamp) > BigInt(version.associatedAt) || (n === 0 && version.associatedAt !== work.createdAt)) fail("version order/Hash/owner/time");
      if (json(version.originalProof) !== json([proof.owner, proof.timestamp, true])) fail("original proof cross-check");
      seen.add(version.fileHash); count++;
    }
  }
  if (count !== b.versionCount || count > 10000) fail("Version total");
  if (!Array.isArray(b.blocks) || b.blocks.length !== Number(b.head.number) + 1 || b.blocks.length > 50000 || b.blocks[0].hash !== b.config.genesisHash || b.blocks.at(-1).hash !== b.head.hash || b.blocks[Number(b.config.deploymentBlock)]?.hash !== b.config.deploymentBlockHash) fail("incomplete block archive");
  const txs = new Map(), logs = [];
  for (let i = 0; i < b.blocks.length; i++) {
    const block = b.blocks[i];
    if (BigInt(block.number) !== BigInt(i) || (i && block.parentHash !== b.blocks[i - 1].hash) || !Array.isArray(block.transactions)) fail("block order");
    for (const tx of block.transactions) {
      if (txs.has(tx.hash) || !tx.raw || keccak256(tx.raw) !== tx.hash || Number(parseTransaction(tx.raw).chainId) !== 31337 || tx.blockHash !== block.hash || !tx.receipt || tx.receipt.transactionHash !== tx.hash || tx.receipt.blockHash !== block.hash) fail("transaction/receipt integrity");
      txs.set(tx.hash, tx); logs.push(...tx.receipt.logs);
    }
  }
  if (txs.size !== b.transactionCount) fail("transaction total");
  if(logs.filter((v)=>v.address.toLowerCase()===b.config.original.toLowerCase()).length !== b.proofs.length) fail("incomplete original registrations");
  const registryEvents=logs.filter((v)=>v.address.toLowerCase()===b.config.registry.toLowerCase()).map((v)=>decodeEventLog({abi:b.abis.registry,topics:v.topics,data:v.data}));
  if(registryEvents.filter((e)=>e.eventName==="WorkCreated").length!==b.workCount || registryEvents.filter((e)=>e.eventName==="VersionAdded").length!==b.versionCount) fail("event totals");
  for (const p of b.proofs) {
    const log = logs.find((v) => v.address.toLowerCase() === b.config.original.toLowerCase() && v.topics[1] === p.fileHash);
    if (!log) fail("missing registration event");
    const event = decodeEventLog({ abi: b.abis.original, topics: log.topics, data: log.data });
    if (event.args.owner.toLowerCase() !== p.owner.toLowerCase() || String(event.args.timestamp) !== p.timestamp) fail("registration event mismatch");
  }
  for (const work of b.works) for (const version of work.versions) {
    const matches = logs.filter((v) => v.address.toLowerCase() === b.config.registry.toLowerCase()).map((v) => ({ log: v, event: decodeEventLog({ abi: b.abis.registry, topics: v.topics, data: v.data }) })).filter(({event}) => event.eventName === "VersionAdded" && String(event.args.workId) === work.id && String(event.args.versionNumber) === version.number);
    if (matches.length !== 1) fail("missing/duplicate version event");
    const {event, log} = matches[0];
    if (event.args.fileHash !== version.fileHash || event.args.controller.toLowerCase() !== work.controller.toLowerCase() || String(event.args.previousVersionNumber) !== version.previousVersionNumber || String(event.args.timestamp) !== version.associatedAt || version.transactionHash !== log.transactionHash || version.blockNumber !== String(BigInt(log.blockNumber))) fail("version event mismatch");
  }
  return b;
}
export async function readBackup(file) {
  const bytes=await readFile(file);
  const sidecar=await readFile(`${file}.sha256`,"utf8");
  if(sidecar.split(/\s+/)[0]!==createHash("sha256").update(bytes).digest("hex")) throw new Error("Backup file SHA-256 mismatch");
  return validateBackup(JSON.parse(bytes));
}
export function serializeRpcTransaction(t) {
  const type = Number(t.type);
  if (![0, 1, 2].includes(type) || Number(t.chainId) !== 31337) throw new Error("Unsupported transaction type or chain; cannot provide replay archive");
  const tx = { type: ["legacy", "eip2930", "eip1559"][type], chainId: 31337, nonce: Number(t.nonce), gas: BigInt(t.gas), value: BigInt(t.value), data: t.input, ...(t.to ? { to: t.to } : {}) };
  if (type < 2) tx.gasPrice = BigInt(t.gasPrice);
  else { tx.maxFeePerGas = BigInt(t.maxFeePerGas); tx.maxPriorityFeePerGas = BigInt(t.maxPriorityFeePerGas); }
  if (type > 0) tx.accessList = t.accessList;
  const raw = serializeTransaction(tx, { r: t.r, s: t.s, v: BigInt(t.v), ...(type > 0 ? { yParity: Number(t.v) } : {}) });
  if (keccak256(raw) !== t.hash) throw new Error("Raw transaction serialization Hash mismatch");
  return raw;
}
export async function capture(request, config, artifacts) {
  const allowed = new Set(["eth_chainId", "web3_clientVersion", "eth_blockNumber", "eth_getBlockByNumber", "eth_getCode", "eth_call", "eth_getTransactionReceipt", "eth_getBalance", "eth_getTransactionCount", "eth_accounts"]);
  const rpc = (method, params = []) => { if (!allowed.has(method)) throw new Error("Read-only RPC required"); return request({ method, params }); };
  if (Number(await rpc("eth_chainId")) !== 31337) throw new Error("Wrong local Chain ID");
  const client = await rpc("web3_clientVersion"); if (!client.startsWith("HardhatNetwork/3.19.0/")) throw new Error("Unexpected local runtime version");
  const head = await rpc("eth_blockNumber"); if (BigInt(head) > BigInt(49999)) throw new Error("Explicit review required for larger export");
  const abis = { original: artifacts.contracts["ChainProof.sol"].ChainProof.abi, registry: artifacts.contracts["ChainProofVersionRegistry.sol"].ChainProofVersionRegistry.abi };
  const read = async (which, fn, args = []) => decodeFunctionResult({ abi: abis[which], functionName: fn, data: await rpc("eth_call", [{ to: config[which], data: encodeFunctionData({ abi: abis[which], functionName: fn, args }) }, head]) });
  const codes = { original: await rpc("eth_getCode", [config.original, head]), registry: await rpc("eth_getCode", [config.registry, head]) };
  if ((await read("registry", "originalRegistry")).toLowerCase() !== config.original.toLowerCase()) throw new Error("Immutable original registry mismatch");
  const next = await read("registry", "nextWorkId"); if (next > BigInt(1001)) throw new Error("Work export limit exceeded");
  const blocks = [];
  for (let n = BigInt(0); n <= BigInt(head); n++) {
    const block = await rpc("eth_getBlockByNumber", [`0x${n.toString(16)}`, true]);
    for (const tx of block.transactions) { tx.raw = serializeRpcTransaction(tx); tx.receipt = await rpc("eth_getTransactionReceipt", [tx.hash]); }
    blocks.push(block);
  }
  const proofs = [];
  for (const block of blocks) for (const tx of block.transactions) for (const log of tx.receipt.logs) {
    if (log.address.toLowerCase() !== config.original.toLowerCase()) continue;
    const event = decodeEventLog({ abi: abis.original, data: log.data, topics: log.topics });
    if (event.eventName !== "ProofRegistered") throw new Error("Unexpected original registry log");
    const [owner, timestamp, exists] = await read("original", "getProof", [event.args.fileHash]);
    if (!exists || owner.toLowerCase() !== event.args.owner.toLowerCase() || timestamp !== event.args.timestamp) throw new Error("Original proof/event disagree");
    proofs.push({ fileHash: event.args.fileHash, owner, timestamp: String(timestamp), transactionHash: tx.hash, blockNumber: String(BigInt(block.number)) });
  }
  const works = [];
  for (let id = BigInt(1); id < next; id++) {
    const work = await read("registry", "getWork", [id]); if (work.versionCount > BigInt(10000)) throw new Error("Version export limit exceeded");
    const versions = [];
    for (let number = BigInt(1); number <= work.versionCount; number++) {
      const version = await read("registry", "getVersion", [id, number]);
      const events = blocks.flatMap((b) => b.transactions.flatMap((tx) => tx.receipt.logs)).filter((l) => l.address.toLowerCase() === config.registry.toLowerCase()).map((log) => ({log, event: decodeEventLog({abi: abis.registry, topics:log.topics,data:log.data})}));
      const entry = events.find(({event}) => event.eventName === "VersionAdded" && event.args.workId === id && event.args.versionNumber === number);
      if (!entry) throw new Error("Missing version event");
      versions.push({ number: String(number), ...JSON.parse(json(version)), originalProof: JSON.parse(json(await read("original", "getProof", [version.fileHash]))), transactionHash:entry.log.transactionHash, blockNumber:String(BigInt(entry.log.blockNumber)), logIndex: String(BigInt(entry.log.logIndex)) });
    }
    works.push({ id: String(id), ...JSON.parse(json(work)), versions });
  }
  const genesisAccounts = [];
  for (const address of await rpc("eth_accounts")) genesisAccounts.push({ address, balance: await rpc("eth_getBalance", [address, "0x0"]), nonce: await rpc("eth_getTransactionCount", [address, "0x0"]) });
  const again = await rpc("eth_getBlockByNumber", [head, false]);
  if (await rpc("eth_blockNumber") !== head || again.hash !== blocks.at(-1).hash) throw new Error("Source chain changed during export; retry without overwriting previous files");
  const payload = { source:"LOCAL EVM ONLY", chainId:31337, rpc:SOURCE_RPC, observedAt:new Date().toISOString(), hardhatVersion:"3.19.0", compiler:artifacts.compiler, restoreType:"signed-transaction replay archive; not a native EVM state dump", config, abis, codes, genesisAccounts, head:{number:String(BigInt(head)),hash:blocks.at(-1).hash}, workCount:works.length, versionCount:works.reduce((n,w)=>n+w.versions.length,0), transactionCount:blocks.reduce((n,b)=>n+b.transactions.length,0), proofs, works, blocks };
  const envelope = seal(payload); validateBackup(envelope); return envelope;
}
export async function saveExclusive(envelope, directory = path.join(root,".local-evm/backups")) {
  validateBackup(envelope); await mkdir(directory,{recursive:true});
  const file = path.join(directory,`chain31337-${new Date().toISOString().replace(/[:.]/g,"-")}-${randomUUID().slice(0,8)}.json`);
  await writeFile(file,JSON.stringify(envelope,null,2),{flag:"wx"});
  await writeFile(`${file}.sha256`,`${createHash("sha256").update(await readFile(file)).digest("hex")}  ${path.basename(file)}\n`,{flag:"wx"});
  return file;
}
if (process.argv[1] === new URL(import.meta.url).pathname.slice(1).replace(/\//g,"\\") || process.argv[1]?.endsWith("backup.mjs")) {
  try {
    const config = JSON.parse(await readFile(path.join(root,".local-evm/deployment.json"),"utf8"));
    const artifacts = JSON.parse(await readFile(path.join(root,".local-evm/artifacts.json"),"utf8"));
    const { clients } = await import("./runtime.mjs"); const {publicClient} = clients();
    const envelope = await capture((args)=>publicClient.request(args),config,artifacts);
    const file = await saveExclusive(envelope);
    console.log(json({file,sha256:envelope.sha256,workCount:envelope.payload.workCount,versionCount:envelope.payload.versionCount,head:envelope.payload.head,transactions:envelope.payload.transactionCount,proofs:envelope.payload.proofs.length}));
  } catch(cause) { console.error(`Backup failed without changing the node: ${cause.shortMessage || cause.message}`); process.exitCode=1; }
}
