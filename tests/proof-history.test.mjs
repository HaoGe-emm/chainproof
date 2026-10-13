import assert from "node:assert/strict";
import test from "node:test";
import { parseAbiItem } from "viem";
import {
  fetchProofLogsAdaptive,
  historyDisplayState,
  newestProofsFirst,
  nextLogRange,
  parseProofLog,
  PROOF_DEPLOYMENT_BLOCK,
  scanProofHistory,
} from "../lib/proof-history.ts";

const contract = "0xC64CEF65ccd720664cc3bfd7D970b6F866E53052";
const owner = "0x89f415bb42e356e8b892c10b05522e0a8ef151f3";
const event = parseAbiItem("event ProofRegistered(bytes32 indexed fileHash, address indexed owner, uint256 timestamp)");

// Public BOT Chain Mainnet receipt: 0x60e363ce4a5c67b86640f9b8d13122a77b2387a12d736518d34070bac454aafc.
const realLog = {
  address: contract,
  topics: [
    "0x6979dae16feac53541a63b91de904f762731ce0f18bdbc8d6a6b7b1a506bed14",
    "0x8ed3e3e1dc015bd4fe18a80b93adccbd93ea9f7ee7a577600ae6d2e07642f625",
    "0x00000000000000000000000089f415bb42e356e8b892c10b05522e0a8ef151f3",
  ],
  data: "0x000000000000000000000000000000000000000000000000000000006ac6fec3",
  blockNumber: BigInt("0x18b8b8b"),
  logIndex: 4,
  transactionHash: "0x60e363ce4a5c67b86640f9b8d13122a77b2387a12d736518d34070bac454aafc",
  removed: false,
};

test("parses the real mainnet ProofRegistered log", () => {
  const record = parseProofLog(realLog, event, contract, owner);
  assert.ok(record);
  assert.equal(record.fileHash, realLog.topics[1]);
  assert.equal(record.owner.toLowerCase(), owner);
  assert.equal(record.timestamp, BigInt("0x6ac6fec3"));
  assert.equal(record.transactionHash, realLog.transactionHash);
  assert.equal(record.blockNumber, BigInt(25_922_443));
  assert.equal(record.logIndex, 4);
});

test("rejects unrelated, removed, or incomplete logs", () => {
  assert.equal(parseProofLog({ ...realLog, address: "0x0000000000000000000000000000000000000001" }, event, contract, owner), null);
  assert.equal(parseProofLog({ ...realLog, removed: true }, event, contract, owner), null);
  assert.equal(parseProofLog(realLog, event, contract, "0x0000000000000000000000000000000000000001"), null);
  assert.throws(() => parseProofLog({ ...realLog, transactionHash: null }, event, contract, owner), /Incomplete/);
});

test("ranges descend from the verified deployment block without overlap", () => {
  const last = PROOF_DEPLOYMENT_BLOCK + BigInt(20_004);
  const ranges = [];
  let cursor = last;
  while (true) {
    const range = nextLogRange(cursor, PROOF_DEPLOYMENT_BLOCK, BigInt(10_000));
    if (!range) break;
    ranges.push(range);
    cursor = range.nextCursor;
  }
  assert.equal(ranges.length, 3);
  assert.equal(ranges[0].toBlock, last);
  assert.equal(ranges.at(-1).fromBlock, PROOF_DEPLOYMENT_BLOCK);
  for (let index = 1; index < ranges.length; index += 1) {
    assert.equal(ranges[index].toBlock + BigInt(1), ranges[index - 1].fromBlock);
  }
  assert.equal(nextLogRange(PROOF_DEPLOYMENT_BLOCK - BigInt(1)), null);
});

test("sorts by block height, then log index, newest first", () => {
  const base = parseProofLog(realLog, event, contract, owner);
  const sorted = newestProofsFirst([
    { ...base, blockNumber: BigInt(2), logIndex: 4 },
    { ...base, blockNumber: BigInt(3), logIndex: 1 },
    { ...base, blockNumber: BigInt(3), logIndex: 8 },
  ]);
  assert.deepEqual(sorted.map(({ blockNumber, logIndex }) => [blockNumber, logIndex]), [[BigInt(3), 8], [BigInt(3), 1], [BigInt(2), 4]]);
});

test("retries a temporary RPC error and returns the recovered logs", async () => {
  let attempts = 0;
  const logs = await fetchProofLogsAdaptive(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("HTTP request failed");
    return [realLog];
  }, BigInt(1), BigInt(100), { sleep: async () => {} });
  assert.equal(attempts, 2);
  assert.deepEqual(logs, [realLog]);
});

test("429 rate limiting retries with bounded backoff without declaring empty history", async () => {
  let attempts = 0;
  const waits = [];
  const logs = await fetchProofLogsAdaptive(async () => {
    attempts += 1;
    if (attempts < 3) throw new Error("HTTP 429 too many requests");
    return [realLog];
  }, BigInt(1), BigInt(100), { sleep: async ms => waits.push(ms) });
  assert.equal(attempts, 3);
  assert.deepEqual(waits, [400, 800]);
  assert.deepEqual(logs, [realLog]);
});

test("timeout exhaustion splits a bounded range and propagates final failure", async () => {
  const ranges = [];
  await assert.rejects(fetchProofLogsAdaptive(async (from, to) => {
    ranges.push([from, to]);
    throw new Error("RPC timeout");
  }, BigInt(0), BigInt(511), { retries: 0, minSplitSpan: BigInt(128), sleep: async () => {} }), /timeout/);
  assert.deepEqual(ranges, [[BigInt(0), BigInt(511)], [BigInt(256), BigInt(511)], [BigInt(384), BigInt(511)]]);
});

test("splits an RPC-limited range and preserves newest-first coverage", async () => {
  const ranges = await fetchProofLogsAdaptive(async (from, to) => {
    if (to - from + BigInt(1) > BigInt(250)) throw new Error("block range too large");
    return [{ from, to }];
  }, BigInt(0), BigInt(999), { retries: 0, minSplitSpan: BigInt(100) });
  assert.equal(ranges[0].to, BigInt(999));
  assert.equal(ranges.at(-1).from, BigInt(0));
  for (let index = 1; index < ranges.length; index += 1) {
    assert.equal(ranges[index].to + BigInt(1), ranges[index - 1].from);
  }
});

test("does not turn an RPC failure or partial scan into an empty state", () => {
  assert.equal(historyDisplayState(owner, "loading", 0), "loading");
  assert.equal(historyDisplayState(owner, "error", 0), "error");
  assert.equal(historyDisplayState(owner, "complete", 0), "empty");
  assert.equal(historyDisplayState(owner, "complete", 1), "results");
  assert.equal(historyDisplayState(null, "complete", 0), "connect");
});

test("rapid account switches never publish an old wallet's delayed scan", async () => {
  let resolveOld;
  let markStarted;
  const started = new Promise((resolve) => { markStarted = resolve; });
  const delayed = new Promise((resolve) => { resolveOld = resolve; });
  let activeAccount = owner;
  const emptyWallet = "0x0000000000000000000000000000000000000001";
  const updates = [];
  const source = {
    getChainId: async () => 677,
    getBlockNumber: async () => realLog.blockNumber + BigInt(6),
    getLogs: async (wallet) => {
      if (wallet === owner) { markStarted(); return delayed; }
      return [];
    },
  };
  function scan(wallet) {
    return scanProofHistory({
      owner: wallet, contract, event, chainId: 677, source,
      shouldStop: () => activeAccount !== wallet,
      onHead: () => {},
      onRange: (records) => updates.push({ wallet, records }),
      onComplete: () => updates.push({ wallet, complete: true }),
    });
  }
  const oldScan = scan(owner);
  await started;
  activeAccount = emptyWallet;
  await scan(emptyWallet);
  resolveOld([realLog]);
  await oldScan;
  assert.ok(updates.length > 0);
  assert.ok(updates.every((update) => update.wallet === emptyWallet));
  assert.equal(updates.at(-1).complete, true);
  assert.ok(updates.filter((update) => update.records).every((update) => update.records.length === 0));
});

test("an abandoned scan stops before issuing logs after a delayed network check", async () => {
  let cancelled = false;
  let finishNetwork;
  let logCalls = 0;
  const scan = scanProofHistory({
    owner, contract, event, chainId: 677,
    source: {
      getChainId: () => new Promise((resolve) => { finishNetwork = resolve; }),
      getBlockNumber: async () => realLog.blockNumber,
      getLogs: async () => { logCalls += 1; return []; },
    },
    shouldStop: () => cancelled,
    onHead: () => assert.fail("old account head"),
    onRange: () => assert.fail("old account records"),
    onComplete: () => assert.fail("old account completion"),
  });
  cancelled = true;
  finishNetwork(677);
  await scan;
  assert.equal(logCalls, 0);
});

test("a failed historical range retains partial records and never marks the scan complete", async () => {
  let calls = 0;
  let complete = false;
  const partial = [];
  await assert.rejects(scanProofHistory({
    owner, contract, event, chainId: 677,
    source: {
      getChainId: async () => 677,
      getBlockNumber: async () => realLog.blockNumber + BigInt(6),
      getLogs: async () => { calls += 1; if (calls > 1) throw new Error("Historical data unavailable"); return [realLog]; },
    },
    shouldStop: () => false, onHead: () => {},
    onRange: (records) => partial.push(...records), onComplete: () => { complete = true; },
  }), /Historical data unavailable/);
  assert.equal(partial.length, 1);
  assert.equal(partial[0].owner.toLowerCase(), owner);
  assert.equal(complete, false);
});
