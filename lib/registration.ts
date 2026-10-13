import { isAddress, type Address, type Hex } from "viem";

export type PendingRegistration = { hash: string; owner: Address; transaction: Hex; chainId: number; contract: Address };

// Persist public transaction metadata only, so a refresh can resume a read-only receipt check.
export function parsePendingRegistration(value: unknown, chainId: number, contract: Address): PendingRegistration | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<PendingRegistration>;
  if (typeof item.hash !== "string" || !/^[0-9a-f]{64}$/.test(item.hash) ||
      typeof item.transaction !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(item.transaction) ||
      !item.owner || !isAddress(item.owner) || !item.contract || !isAddress(item.contract) ||
      item.chainId !== chainId || item.contract.toLowerCase() !== contract.toLowerCase()) return null;
  return { hash: item.hash, owner: item.owner, transaction: item.transaction as Hex, chainId: item.chainId, contract: item.contract };
}
