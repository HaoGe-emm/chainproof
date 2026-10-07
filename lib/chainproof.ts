import { createPublicClient, defineChain, getAddress, http, parseAbi, parseEventLogs, type Address, type Hex, type TransactionReceipt } from "viem";

export const BOHR_RPC_URL = "https://rpc.bohr.life";
export const BOTSCAN_URL = "https://scan.bohr.life";
export const CHAIN_PROOF_ADDRESS = getAddress("0xC64CEF65ccd720664cc3bfd7D970b6F866E53052");

export const bohrTestnet = defineChain({
  id: 968,
  name: "Bohr Testnet",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: { default: { http: [BOHR_RPC_URL] } },
  blockExplorers: { default: { name: "BOTScan", url: BOTSCAN_URL } },
});

export const chainProofAbi = parseAbi([
  "function registerProof(bytes32 fileHash)",
  "function getProof(bytes32 fileHash) view returns (address owner, uint256 timestamp, bool exists)",
  "event ProofRegistered(bytes32 indexed fileHash, address indexed owner, uint256 timestamp)",
]);

export const publicClient = createPublicClient({
  chain: bohrTestnet,
  transport: http(BOHR_RPC_URL),
});

export function toFileHashBytes32(hash: string): Hex {
  if (!/^[0-9a-fA-F]{64}$/.test(hash)) throw new Error("Invalid SHA-256 fingerprint.");
  return `0x${hash.toLowerCase()}`;
}

export function receiptRegistersProof(receipt: Pick<TransactionReceipt, "status" | "logs">, fileHash: Hex, owner: Address): boolean {
  if (receipt.status !== "success") return false;
  return parseEventLogs({ abi: chainProofAbi, eventName: "ProofRegistered", logs: receipt.logs }).some((log) =>
    log.address.toLowerCase() === CHAIN_PROOF_ADDRESS.toLowerCase() &&
    log.args.fileHash.toLowerCase() === fileHash.toLowerCase() &&
    log.args.owner.toLowerCase() === owner.toLowerCase()
  );
}

export async function readProof(hash: string) {
  const chainId = await publicClient.getChainId();
  if (chainId !== bohrTestnet.id) throw new Error("Bohr RPC returned the wrong chain.");
  return publicClient.readContract({
    address: CHAIN_PROOF_ADDRESS,
    abi: chainProofAbi,
    functionName: "getProof",
    args: [toFileHashBytes32(hash)],
  });
}
