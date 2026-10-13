// Stage 4A only. These fixtures and associations are not blockchain records.
export const VERSION_DEMO_KEY = "chainproof:version-prototype:v1";
export const DEMO_WALLETS = ["0x0000000000000000000000000000000000000002", "0x0000000000000000000000000000000000000003"] as const;
export const MAINNET_COMPATIBILITY_HASH = "0x8ed3e3e1dc015bd4fe18a80b93adccbd93ea9f7ee7a577600ae6d2e07642f625";
export type DemoProof = { source: "demo"; fileHash: string; name: string; content: string; registeredWallet: string; registeredTimestamp: number };
export const DEMO_PROOFS: readonly DemoProof[] = [
  { source: "demo", fileHash: "0xe6961a859e8b5195e78d6febaa623273583bda7583e3db45c7564fe71c240f0b", name: "Draft 1 / wallet A", content: "ChainProof version prototype draft 1\n", registeredWallet: DEMO_WALLETS[0], registeredTimestamp: 1700000200 },
  { source: "demo", fileHash: "0x1fcc93e1546deb4e27180045ce897bc4d17025a164e824d18ef5c7451705395a", name: "Draft 2 / wallet A", content: "ChainProof version prototype draft 2\n", registeredWallet: DEMO_WALLETS[0], registeredTimestamp: 1700000100 },
  { source: "demo", fileHash: "0xfc411101f6683a9f031675f97be7dbc22a40bc9eccaed434daff826a40eb0b71", name: "Draft 3 / wallet A", content: "ChainProof version prototype draft 3\n", registeredWallet: DEMO_WALLETS[0], registeredTimestamp: 1700000300 },
  { source: "demo", fileHash: "0xd6ab17eb59e9890b617809e189c81202d154f9079bd67832a0e36ef19d7dd040", name: "Collaborator draft / wallet B", content: "ChainProof version prototype collaborator\n", registeredWallet: DEMO_WALLETS[1], registeredTimestamp: 1700000400 },
];

export type DemoVersion = {
  source: "demo"; versionId: string; workId: string; fileHash: string;
  versionNumber: number; versionLabel: string; previousVersionId: string | null;
  registeredWallet: string; registeredTimestamp: number; associationTimestamp: number;
};
export type DemoWork = {
  source: "demo"; workId: string; creator: string; controller: string;
  createdAt: number; title: string; description: string; versions: DemoVersion[];
};

export function validDemoWorkId(value: string): boolean {
  return /^demo-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
}
function validTime(value: number): boolean { return Number.isSafeInteger(value) && value > 0 && value <= 8_640_000_000_000; }
function text(value: string, limit: number): string {
  if (typeof value !== "string" || value.trim().length > limit) throw new Error("The local label is too long or invalid.");
  return value.trim();
}
export function createDemoWork(input: { workId: string; controller: string; title: string; description: string; now: number }): DemoWork {
  if (!validDemoWorkId(input.workId) || !(DEMO_WALLETS as readonly string[]).includes(input.controller) || !validTime(input.now)) throw new Error("Invalid demo work.");
  const title = text(input.title, 120);
  if (!title) throw new Error("Enter a title for this local demo.");
  return { source: "demo", workId: input.workId, creator: input.controller, controller: input.controller, createdAt: input.now, title, description: text(input.description, 600), versions: [] };
}

// Simulates the proposed single-controller rule; actor selection is NOT authentication.
export function appendDemoVersion(work: DemoWork, input: { actor: string; fileHash: string; versionLabel: string; expectedPreviousVersionId: string | null; now: number }): DemoWork {
  if (work.source !== "demo" || !validDemoWorkId(work.workId)) throw new Error("Only local demo works are supported.");
  if (input.actor !== work.controller) throw new Error("Demo rule: only the work controller can append.");
  const proof = DEMO_PROOFS.find((item) => item.fileHash === input.fileHash.toLowerCase());
  if (!proof) throw new Error("No demo proof exists for this hash. Real proofs use the separate read-only panel.");
  if (proof.registeredWallet !== input.actor) throw new Error("Demo rule: the original registered wallet must authorize the association.");
  if (work.versions.some((item) => item.fileHash === proof.fileHash)) throw new Error("This fingerprint is already linked to this demo work.");
  const head = work.versions.at(-1);
  if (input.expectedPreviousVersionId !== (head?.versionId ?? null)) throw new Error("The previous version changed. Review the timeline before appending.");
  if (!validTime(input.now)) throw new Error("Invalid local association time.");
  if (work.versions.length >= 50) throw new Error("This prototype supports at most 50 versions per work.");
  const versionNumber = work.versions.length + 1;
  const version: DemoVersion = {
    source: "demo", versionId: `${work.workId}:v${versionNumber}`, workId: work.workId,
    fileHash: proof.fileHash, versionNumber, versionLabel: text(input.versionLabel, 60),
    previousVersionId: head?.versionId ?? null, registeredWallet: proof.registeredWallet,
    registeredTimestamp: proof.registeredTimestamp,
    associationTimestamp: Math.max(input.now, head?.associationTimestamp ?? work.createdAt),
  };
  return { ...work, versions: [...work.versions, version] };
}

export function findDemoFileVersion(work: DemoWork, sha256: string): DemoVersion | null {
  if (!/^[0-9a-fA-F]{64}$/.test(sha256)) return null;
  return work.versions.find((item) => item.source === "demo" && item.fileHash === `0x${sha256.toLowerCase()}`) ?? null;
}

export function encodeDemoWorks(works: DemoWork[]): string {
  // Round-trip validation strips unknown fields and never stores uploaded file bytes.
  return JSON.stringify({ schema: 1, source: "demo", works: decodeDemoWorks(JSON.stringify({ schema: 1, source: "demo", works })) });
}

export function decodeDemoWorks(raw: string | null): DemoWork[] {
  if (!raw) return [];
  if (raw.length > 128_000) throw new Error("Saved prototype data exceeds the size limit.");
  const state = JSON.parse(raw);
  if (!state || state.schema !== 1 || state.source !== "demo" || !Array.isArray(state.works) || state.works.length > 20) throw new Error("Invalid prototype storage schema.");
  const ids = new Set<string>();
  return state.works.map((item: DemoWork) => {
    if (!item || item.source !== "demo" || item.creator !== item.controller || !Array.isArray(item.versions) || item.versions.length > 50 || ids.has(item.workId)) throw new Error("Invalid or duplicate demo work.");
    ids.add(item.workId);
    let work = createDemoWork({ ...item, now: item.createdAt });
    for (const version of item.versions) {
      if (!version || version.source !== "demo" || version.workId !== work.workId || !validTime(version.associationTimestamp) || version.associationTimestamp < (work.versions.at(-1)?.associationTimestamp ?? work.createdAt)) throw new Error("Invalid local version association.");
      work = appendDemoVersion(work, { actor: work.controller, fileHash: version.fileHash, versionLabel: version.versionLabel, expectedPreviousVersionId: version.previousVersionId, now: version.associationTimestamp });
      const reconstructed = work.versions.at(-1)!;
      if (version.versionId !== reconstructed.versionId || version.versionNumber !== reconstructed.versionNumber || version.registeredWallet !== reconstructed.registeredWallet || version.registeredTimestamp !== reconstructed.registeredTimestamp) throw new Error("Stored version does not match the demo fixture or sequence.");
    }
    return work;
  });
}
