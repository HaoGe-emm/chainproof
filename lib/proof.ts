export const PROOF_TYPES = ["AI Content", "Hackathon Submission", "Research", "Creative Work", "Other"] as const;
export type ProofType = (typeof PROOF_TYPES)[number];

export type FileFingerprint = {
  name: string;
  size: number;
  hash: string;
};

export async function fingerprintFile(file: File): Promise<FileFingerprint> {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return { name: file.name, size: file.size, hash };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
