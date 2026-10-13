import { isAddress, type Address, type Hex } from "viem";

export type CertificateState =
  | { status: "invalid" }
  | { status: "loading"; hash: Hex }
  | { status: "not-found"; hash: Hex }
  | { status: "error"; hash: Hex }
  | { status: "registered"; hash: Hex; owner: Address; timestamp: bigint };

export function normalizeCertificateHash(value: string): Hex | null {
  return /^0x[0-9a-fA-F]{64}$/.test(value) ? value.toLowerCase() as Hex : null;
}

export function certificatePath(hash: string): string {
  const normalized = normalizeCertificateHash(hash);
  if (!normalized) throw new Error("Invalid certificate fingerprint.");
  return `/proof/${normalized}`;
}

export function certificateUrl(origin: string, hash: string): string {
  const site = new URL(origin);
  if (site.protocol !== "http:" && site.protocol !== "https:") throw new Error("Invalid website origin.");
  return new URL(certificatePath(hash), site.origin).href;
}

export function isLocalCertificateUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "localhost" || hostname.endsWith(".localhost") ||
      hostname === "[::1]" || hostname === "0.0.0.0" || /^127\./.test(hostname);
  } catch {
    return false;
  }
}

// The reader is the existing public getProof call; no wallet is needed.
export async function loadCertificate(
  value: string,
  read: (sha256: string) => Promise<readonly [Address, bigint, boolean]>,
): Promise<CertificateState> {
  const hash = normalizeCertificateHash(value);
  if (!hash) return { status: "invalid" };
  try {
    const [owner, timestamp, exists] = await read(hash.slice(2));
    if (typeof exists !== "boolean" || typeof timestamp !== "bigint" || !isAddress(owner)) throw new Error("Invalid registration record.");
    if (!exists) return { status: "not-found", hash };
    if (/^0x0{40}$/i.test(owner) || timestamp <= BigInt(0) || Number.isNaN(new Date(Number(timestamp) * 1000).getTime())) throw new Error("Invalid registration record.");
    return { status: "registered", hash, owner, timestamp };
  } catch {
    return { status: "error", hash };
  }
}

export type CopyResult = "match" | "mismatch" | "error" | "unavailable";

export async function verifyFileCopy(
  file: File,
  certificate: CertificateState,
  fingerprint: (file: File) => Promise<{ hash: string }>,
): Promise<CopyResult> {
  if (certificate.status !== "registered") return "unavailable";
  try {
    const result = await fingerprint(file);
    if (!/^[0-9a-fA-F]{64}$/.test(result.hash)) throw new Error("Invalid file fingerprint.");
    return `0x${result.hash.toLowerCase()}` === certificate.hash ? "match" : "mismatch";
  } catch {
    return "error";
  }
}
