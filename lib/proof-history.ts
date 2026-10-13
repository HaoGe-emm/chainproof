import { decodeEventLog, isAddressEqual, type AbiEvent, type Address, type Hex } from "viem";

// BOTScan creation transaction: 0x72bd59f3b4c46176845456310b4cc8a64e8a09bfbec2c6442f6d09e9de4be9c1.
export const PROOF_DEPLOYMENT_BLOCK = BigInt(25_857_169);
export const PROOF_LOG_BLOCK_SPAN = BigInt(10_000);
export const PROOF_CONFIRMATIONS = BigInt(6);

export type ProofRecord = {
  fileHash: Hex;
  owner: Address;
  timestamp: bigint;
  transactionHash: Hex;
  blockNumber: bigint;
  logIndex: number;
};

export type ProofLog = {
  address: Address;
  topics: readonly Hex[];
  data: Hex;
  blockNumber: bigint | null;
  logIndex: number | null;
  transactionHash: Hex | null;
  removed?: boolean;
};

export type LogRange = { fromBlock: bigint; toBlock: bigint; nextCursor: bigint };

export function nextLogRange(cursor: bigint, firstBlock = PROOF_DEPLOYMENT_BLOCK, span = PROOF_LOG_BLOCK_SPAN): LogRange | null {
  if (span < BigInt(1)) throw new Error("Log range must contain at least one block.");
  if (cursor < firstBlock) return null;
  const fromBlock = cursor - span + BigInt(1) > firstBlock ? cursor - span + BigInt(1) : firstBlock;
  return { fromBlock, toBlock: cursor, nextCursor: fromBlock - BigInt(1) };
}

export function parseProofLog(log: ProofLog, event: AbiEvent, contract: Address, requestedOwner: Address): ProofRecord | null {
  if (log.removed || !isAddressEqual(log.address, contract)) return null;
  if (log.topics.length < 3 || log.blockNumber === null || log.logIndex === null || !log.transactionHash) {
    throw new Error("Incomplete proof event log.");
  }

  const decoded = decodeEventLog({
    abi: [event],
    eventName: "ProofRegistered",
    data: log.data,
    topics: log.topics as [Hex, ...Hex[]],
    strict: true,
  }) as { args: { fileHash?: unknown; owner?: unknown; timestamp?: unknown } };
  const args = decoded.args;
  if (typeof args.fileHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(args.fileHash) ||
      typeof args.owner !== "string" || typeof args.timestamp !== "bigint") {
    throw new Error("Invalid proof event data.");
  }
  if (!isAddressEqual(args.owner as Address, requestedOwner)) return null;
  return {
    fileHash: args.fileHash as Hex,
    owner: args.owner as Address,
    timestamp: args.timestamp,
    transactionHash: log.transactionHash,
    blockNumber: log.blockNumber,
    logIndex: log.logIndex,
  };
}

export function newestProofsFirst(records: ProofRecord[]): ProofRecord[] {
  return [...records].sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber > b.blockNumber ? -1 : 1;
    if (a.logIndex !== b.logIndex) return b.logIndex - a.logIndex;
    return a.transactionHash.localeCompare(b.transactionHash);
  });
}

function errorText(error: unknown): string {
  if (!error || typeof error !== "object") return String(error);
  const item = error as { shortMessage?: string; message?: string; cause?: unknown };
  return [item.shortMessage, item.message, item.cause ? errorText(item.cause) : ""].filter(Boolean).join(" ").toLowerCase();
}

function isRangeError(error: unknown): boolean {
  return /block range|range.*(large|exceed|limit)|too many blocks|query returned more than|response size|limit exceeded|result limit/.test(errorText(error));
}

function isTemporaryError(error: unknown): boolean {
  return /timeout|timed out|429|rate limit|too many requests|http request|fetch failed|failed to fetch|network error|\b50[234]\b/.test(errorText(error));
}

type FetchOptions = {
  retries?: number;
  minSplitSpan?: bigint;
  sleep?: (ms: number) => Promise<void>;
  shouldStop?: () => boolean;
};

export async function fetchProofLogsAdaptive<T>(
  fetchRange: (fromBlock: bigint, toBlock: bigint) => Promise<T[]>,
  fromBlock: bigint,
  toBlock: bigint,
  options: FetchOptions = {},
  depth = 0,
): Promise<T[]> {
  const retries = options.retries ?? 2;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (options.shouldStop?.()) throw new Error("Scan cancelled.");
    try {
      return await fetchRange(fromBlock, toBlock);
    } catch (error) {
      lastError = error;
      if (isRangeError(error)) break;
      if (!isTemporaryError(error) || attempt === retries) break;
      await sleep(400 * 2 ** attempt);
    }
  }

  const canSplit = isRangeError(lastError) || /timeout|timed out/.test(errorText(lastError));
  if (!canSplit || toBlock - fromBlock + BigInt(1) <= (options.minSplitSpan ?? BigInt(128)) || depth >= 7) throw lastError;
  const midpoint = (fromBlock + toBlock) / BigInt(2);
  const newer = await fetchProofLogsAdaptive(fetchRange, midpoint + BigInt(1), toBlock, options, depth + 1);
  const older = await fetchProofLogsAdaptive(fetchRange, fromBlock, midpoint, options, depth + 1);
  return [...newer, ...older];
}

export type HistoryStatus = "loading" | "complete" | "error";

export function historyDisplayState(address: Address | null, status: HistoryStatus, count: number): "connect" | "loading" | "empty" | "error" | "results" {
  if (!address) return "connect";
  if (status === "error") return "error";
  if (status === "loading") return "loading";
  return count === 0 ? "empty" : "results";
}

type HistoryScanOptions = {
  owner: Address;
  contract: Address;
  event: AbiEvent;
  chainId: number;
  source: {
    getChainId: () => Promise<number>;
    getBlockNumber: () => Promise<bigint>;
    getLogs: (owner: Address, fromBlock: bigint, toBlock: bigint) => Promise<ProofLog[]>;
  };
  shouldStop: () => boolean;
  onHead: (head: bigint) => void;
  onRange: (records: ProofRecord[], fromBlock: bigint) => void;
  onComplete: () => void;
};

// Every async boundary checks cancellation before publishing account-specific data.
export async function scanProofHistory(options: HistoryScanOptions): Promise<void> {
  const { source, shouldStop } = options;
  const chainId = await source.getChainId();
  if (shouldStop()) return;
  if (chainId !== options.chainId) throw new Error("The RPC returned the wrong network.");
  const latest = await source.getBlockNumber();
  if (shouldStop()) return;
  const head = latest > PROOF_CONFIRMATIONS ? latest - PROOF_CONFIRMATIONS : BigInt(0);
  options.onHead(head);
  let cursor = head;
  while (!shouldStop()) {
    const range = nextLogRange(cursor);
    if (!range) break;
    const logs = await fetchProofLogsAdaptive(
      (from, to) => source.getLogs(options.owner, from, to),
      range.fromBlock, range.toBlock, { shouldStop },
    );
    if (shouldStop()) return;
    const records = logs.map((log) => parseProofLog(log, options.event, options.contract, options.owner))
      .filter((record): record is ProofRecord => record !== null);
    options.onRange(records, range.fromBlock);
    cursor = range.nextCursor;
  }
  if (!shouldStop()) options.onComplete();
}
