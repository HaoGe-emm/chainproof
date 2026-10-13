import { createPublicClient, createWalletClient, defineChain, http, keccak256, parseAbi, parseEventLogs, type Address, type Hex, type TransactionReceipt } from "viem";
import { LOCAL_EVM_ID, LOCAL_EVM_RPC, type LocalDeployment } from "./local-evm-safety";
import { versionRegistryAbi } from "./version-registry-abi";
import { fetchProofLogsAdaptive, nextLogRange } from "./proof-history";
export const localChain = defineChain({ id: LOCAL_EVM_ID, name: "Isolated Local EVM", nativeCurrency: { name: "Development ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [LOCAL_EVM_RPC] } } });
export const localClient = createPublicClient({ chain: localChain, transport: http(LOCAL_EVM_RPC, { timeout: 4000, retryCount: 0 }), pollingInterval: 300 });
export const originalReadAbi = parseAbi(["function getProof(bytes32 fileHash) view returns (address owner, uint256 timestamp, bool exists)"]);
export const versionEventsAbi = parseAbi([
  "event WorkCreated(uint256 indexed workId, address indexed controller, bytes32 fileHash, uint256 versionNumber, uint256 timestamp)",
  "event VersionAdded(uint256 indexed workId, address indexed controller, bytes32 indexed fileHash, uint256 versionNumber, uint256 previousVersionNumber, uint256 timestamp)",
]);
export async function localAccounts(): Promise<Address[]> {
  // eth_accounts belongs to the wallet RPC schema, not viem's PublicClient schema.
  return createWalletClient({ chain: localChain, transport: http(LOCAL_EVM_RPC, { retryCount: 0, timeout: 4000 }) }).getAddresses();
}
export async function checkLocalDeployment(config: LocalDeployment) {
  if (await localClient.getChainId() !== LOCAL_EVM_ID) throw new Error("Wrong Local Network");
  const [original, registry, genesis] = await Promise.all([localClient.getCode({ address: config.original }), localClient.getCode({ address: config.registry }), localClient.getBlock({ blockNumber: BigInt(0) })]);
  if (!original || original === "0x" || !registry || registry === "0x") throw new Error("Contract Not Deployed");
  const block = await localClient.getBlock({ blockNumber: BigInt(config.deploymentBlock) });
  if (keccak256(original) !== config.originalCodeHash || keccak256(registry) !== config.registryCodeHash || genesis.hash !== config.genesisHash || block.hash !== config.deploymentBlockHash) throw new Error("Incorrect Local Contract Configuration");
  const bound = await localClient.readContract({ address: config.registry, abi: versionRegistryAbi, functionName: "originalRegistry" });
  if (bound.toLowerCase() !== config.original.toLowerCase()) throw new Error("Incorrect Local Contract Configuration");
}
export async function readLocalProof(config: LocalDeployment, hash: Hex) {
  return localClient.readContract({ address: config.original, abi: originalReadAbi, functionName: "getProof", args: [hash] });
}
export async function readLocalWork(config: LocalDeployment, id: bigint) {
  return localClient.readContract({ address: config.registry, abi: versionRegistryAbi, functionName: "getWork", args: [id] });
}
export type LocalVersion = { number: bigint; fileHash: Hex; previousVersionNumber: bigint; associatedAt: bigint; owner: Address; registeredAt: bigint };
export async function readVersionPage(config: LocalDeployment, id: bigint, from: bigint, count: bigint, controller: Address) {
  const result: LocalVersion[] = [];
  const end = from + BigInt(9) < count ? from + BigInt(9) : count;
  for (let number = from; number <= end; number++) {
    const entry = await localClient.readContract({ address: config.registry, abi: versionRegistryAbi, functionName: "getVersion", args: [id, number] });
    const [owner, registeredAt, exists] = await readLocalProof(config, entry.fileHash);
    if (!exists || owner.toLowerCase() !== controller.toLowerCase() || registeredAt === BigInt(0) || registeredAt > entry.associatedAt || entry.previousVersionNumber !== number - BigInt(1)) throw new Error("Invalid local version record");
    result.push({ number, ...entry, owner, registeredAt });
  }
  return result;
}
export async function scanLocalWorks(config: LocalDeployment, controller: Address, stop: () => boolean, publish: (ids: bigint[], block: bigint) => void) {
  await checkLocalDeployment(config); if (stop()) return false;
  // Local automining, one receipt confirmation. This is not public-chain finality.
  let cursor = await localClient.getBlockNumber({ cacheTime: 0 });
  const first = BigInt(config.deploymentBlock);
  const seen = new Set<string>();
  while (!stop()) {
    const range = nextLogRange(cursor, first, BigInt(500)); if (!range) return true;
    const logs = await fetchProofLogsAdaptive((fromBlock, toBlock) => localClient.getContractEvents({ address: config.registry, abi: versionEventsAbi, eventName: "WorkCreated", args: { controller }, fromBlock, toBlock, strict: true }), range.fromBlock, range.toBlock, { shouldStop: stop });
    if (stop()) return false;
    const ids = logs.filter((log) => !log.removed && log.address.toLowerCase() === config.registry.toLowerCase() && log.args.controller?.toLowerCase() === controller.toLowerCase()).sort((a, b) => a.blockNumber === b.blockNumber ? b.logIndex - a.logIndex : a.blockNumber > b.blockNumber ? -1 : 1).map((log) => log.args.workId).filter((id) => { if (seen.has(id.toString())) return false; seen.add(id.toString()); return true; });
    publish(ids, range.fromBlock); cursor = range.nextCursor;
  }
  return false;
}
export async function sendLocal(config: LocalDeployment, account: Address, intent: { kind: "create"; hash: Hex } | { kind: "add"; id: bigint; hash: Hex; previous: bigint }, isCurrent: () => boolean = () => true) {
  await checkLocalDeployment(config);
  const accounts = await localAccounts();
  if (!accounts.some((item) => item.toLowerCase() === account.toLowerCase())) throw new Error("Wallet Disconnected");
  const wallet = createWalletClient({ account, chain: localChain, transport: http(LOCAL_EVM_RPC, { retryCount: 0, timeout: 4000 }) });
  if (intent.kind === "create") {
    const { request } = await localClient.simulateContract({ account, address: config.registry, abi: versionRegistryAbi, functionName: "createWork", args: [intent.hash] });
    await checkLocalDeployment(config); if (!isCurrent()) throw new Error("Wallet Disconnected"); return wallet.writeContract(request);
  }
  const { request } = await localClient.simulateContract({ account, address: config.registry, abi: versionRegistryAbi, functionName: "addVersion", args: [intent.id, intent.hash, intent.previous] });
  await checkLocalDeployment(config); if (!isCurrent()) throw new Error("Wallet Disconnected"); return wallet.writeContract(request);
}
export function confirmLocalReceipt(receipt: Pick<TransactionReceipt, "status" | "logs">, config: LocalDeployment, owner: Address, hash: Hex) {
  if (receipt.status !== "success") throw new Error("Transaction Reverted");
  const events = parseEventLogs({ abi: versionEventsAbi, eventName: "VersionAdded", logs: receipt.logs, strict: true });
  const event = events.find((entry) => entry.address.toLowerCase() === config.registry.toLowerCase() && entry.args.controller.toLowerCase() === owner.toLowerCase() && entry.args.fileHash === hash);
  if (!event) throw new Error("Receipt did not confirm the requested version");
  return event.args;
}
export function localError(cause: unknown): string {
  const error = cause as { message?: string; cause?: unknown; data?: { errorName?: string } };
  if (error?.data?.errorName) return ({ NotController: "Unauthorized Wallet", NotOriginalRegistrant: "Unauthorized Wallet: not the original registrant", HashAlreadyLinked: "Duplicate Hash", OriginalProofNotFound: "Original Proof Not Found", WorkNotFound: "Work Not Found", UnexpectedPreviousVersion: "Version order changed. Refresh before retrying.", OriginalRegistryUnavailable: "Original registry unavailable" } as Record<string, string>)[error.data.errorName] || "Contract call failed";
  const text = error?.message ?? "";
  if (text.includes("Invalid local deployment configuration")) return "Incorrect Local Contract Configuration";
  if (text.includes("loopback website")) return "Local development requires a loopback website.";
  for (const label of ["Wrong Local Network", "Contract Not Deployed", "Incorrect Local Contract Configuration", "Wallet Disconnected", "Transaction Reverted"]) if (text.includes(label)) return label;
  if (error?.cause) return localError(error.cause);
  return "Local RPC Offline / Network Error. Retry when the isolated node is available.";
}
