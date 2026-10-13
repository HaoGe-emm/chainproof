"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import FilePicker from "@/components/file-picker";
import { useVersionPrototype } from "@/components/version-prototype-provider";
import { certificatePath, loadCertificate, normalizeCertificateHash, type CertificateState } from "@/lib/certificate";
import { readProof } from "@/lib/chainproof";
import { type FileFingerprint } from "@/lib/proof";
import { appendDemoVersion, createDemoWork, DEMO_PROOFS, DEMO_WALLETS, findDemoFileVersion, MAINNET_COMPATIBILITY_HASH, validDemoWorkId, type DemoWork } from "@/lib/version-history";

const inputClass = "mt-2 block w-full min-w-0 rounded-xl border border-white/15 bg-[#14161b] px-4 py-3 text-sm text-white outline-none focus:border-white/50";
const buttonClass = "rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40";
const secondaryClass = "rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-white/5";
function date(timestamp: number) { return `${new Date(timestamp * 1000).toISOString().replace("T", " ").slice(0, 19)} UTC`; }
function message(cause: unknown) { return cause instanceof Error ? cause.message : "Could not update the local demo."; }

function CopyHash({ hash }: { hash: string }) {
  const [status, setStatus] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  async function copy() {
    try { await navigator.clipboard.writeText(hash); setStatus("Copied full hash."); }
    catch { setStatus("Copy unavailable. Select the full hash above."); }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(""), 2500);
  }
  return <div><button type="button" onClick={() => void copy()} className={secondaryClass}>Copy Hash</button><p role="status" className="mt-1 text-xs text-zinc-400">{status}</p></div>;
}

export function MainnetCompatibilityPanel() {
  const [hash, setHash] = useState(MAINNET_COMPATIBILITY_HASH);
  const [record, setRecord] = useState<CertificateState | null>(null);
  const request = useRef(0);
  useEffect(() => () => { request.current += 1; }, []);
  async function check(event: FormEvent) {
    event.preventDefault();
    const current = ++request.current;
    const normalized = normalizeCertificateHash(hash);
    if (!normalized) { setRecord({ status: "invalid" }); return; }
    setRecord({ status: "loading", hash: normalized });
    const result = await loadCertificate(normalized, readProof);
    if (current === request.current) setRecord(result);
  }
  return <section aria-label="Real single-file compatibility check" className="mt-10 min-w-0 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.025] p-5 sm:p-6">
    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-300">Separate source · Real mainnet read only</p>
    <h2 className="mt-3 text-xl font-semibold">Check an existing single-file proof</h2>
    <p className="mt-3 text-sm leading-6 text-zinc-400">This reads the original contract on chain 677. It does not add a real proof to the demo timeline or create any version relationship. No wallet is needed.</p>
    <form onSubmit={(event) => void check(event)} className="mt-5">
      <label className="text-sm text-zinc-300">Existing file fingerprint<input value={hash} onChange={(event) => { request.current += 1; setHash(event.target.value); setRecord(null); }} maxLength={66} className={`${inputClass} font-mono`} spellCheck={false} /></label>
      <button type="submit" disabled={record?.status === "loading"} className={`${secondaryClass} mt-4`}>{record?.status === "loading" ? "Reading original registry…" : record?.status === "error" ? "Retry read-only check" : "Read mainnet proof"}</button>
    </form>
    <div aria-live="polite" className="mt-5 text-sm leading-6">
      {record?.status === "invalid" && <p className="text-amber-300">Enter 0x followed by 64 hexadecimal characters.</p>}
      {record?.status === "not-found" && <p className="text-zinc-300">No single-file registration found. No relationship was created.</p>}
      {record?.status === "error" && <p role="alert" className="text-red-300">Mainnet query failed. Registration status is unknown. Retry the read-only check.</p>}
      {record?.status === "registered" && <div data-testid="real-proof-result"><p className="font-medium text-emerald-300">Single-file registration confirmed · BOT Chain Mainnet</p><dl className="mt-4 space-y-4"><div><dt className="text-xs text-zinc-500">Registered Wallet (from original contract)</dt><dd className="mt-1 break-all font-mono text-xs text-zinc-300">{record.owner}</dd></div><div><dt className="text-xs text-zinc-500">Registered Time (not creation time)</dt><dd className="mt-1 text-zinc-300">{date(Number(record.timestamp))}</dd></div><div><dt className="text-xs text-zinc-500">File Fingerprint</dt><dd className="mt-1 break-all font-mono text-xs text-zinc-300">{record.hash}</dd></div></dl><Link href={certificatePath(record.hash)} className="mt-5 inline-block text-emerald-300 underline underline-offset-4">View existing public certificate</Link><p className="mt-3 text-xs text-zinc-400">This proof confirms a single-file registration only. It does not authenticate a work relationship or identify the original author.</p></div>}
    </div>
  </section>;
}

export function DemoWorksList() {
  const { works } = useVersionPrototype();
  return <>
    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Version History</h1>
    <p className="mt-3 text-sm leading-6 text-zinc-400">Explore how a work could organize multiple fingerprints. This prototype uses local examples only.</p>
    <Link href="/works/new" className={`${buttonClass} mt-6 inline-block`}>Create a demo work</Link>
    {!works.length ? <div className="mt-8 rounded-2xl border border-dashed border-white/15 p-8 text-sm text-zinc-400">No local demo works yet. Create one to try the timeline.</div> : <ul className="mt-8 grid min-w-0 gap-4 sm:grid-cols-2">{works.map((work) => <li key={work.workId} className="min-w-0 rounded-2xl border border-white/10 p-5"><p className="text-xs text-amber-300">Local demo · {work.versions.length} {work.versions.length === 1 ? "version" : "versions"}</p><Link href={`/works/${work.workId}`} className="mt-3 block break-words text-xl font-medium hover:underline">{work.title}</Link><p className="mt-3 break-all font-mono text-xs leading-6 text-zinc-500">{work.workId}</p><p className="mt-2 text-xs text-zinc-400">Created locally: {date(work.createdAt)}</p></li>)}</ul>}
    <MainnetCompatibilityPanel />
  </>;
}

export function NewDemoWork() {
  const router = useRouter();
  const { save } = useVersionPrototype();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [controller, setController] = useState<string>(DEMO_WALLETS[0]);
  const [error, setError] = useState("");
  function create(event: FormEvent) {
    event.preventDefault(); setError("");
    try {
      const work = createDemoWork({ workId: `demo-${crypto.randomUUID()}`, title, description, controller, now: Math.floor(Date.now() / 1000) });
      save(work); router.push(`/works/${work.workId}`);
    } catch (cause) { setError(message(cause)); }
  }
  return <>
    <h1 className="text-3xl font-semibold tracking-tight">Create demo work</h1>
    <p className="mt-3 text-sm leading-6 text-zinc-400">Nothing is published or signed. Title and description are editable local statements, not evidence of authorship.</p>
    <form onSubmit={create} className="mt-8 grid gap-6 rounded-2xl border border-white/10 p-5 sm:p-6">
      <label className="text-sm text-zinc-300">Title · User-provided<input required value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} className={inputClass} /></label>
      <label className="text-sm text-zinc-300">Description · Local only<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={600} rows={3} className={inputClass} /></label>
      <label className="text-sm text-zinc-300">Simulated controller<select aria-label="Simulated controller" value={controller} onChange={(event) => setController(event.target.value)} className={inputClass}><option value={DEMO_WALLETS[0]}>Demo wallet A (…0002)</option><option value={DEMO_WALLETS[1]}>Demo wallet B (…0003)</option></select></label>
      <p className="break-all font-mono text-xs leading-6 text-zinc-500">{controller}</p>
      <p className="text-xs leading-6 text-amber-200">Selecting an address simulates a rule. It does not connect MetaMask or prove control of a wallet.</p>
      <button type="submit" className={`${buttonClass} justify-self-start`}>Create local demo</button>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    </form>
  </>;
}

export function DemoWorkDetail({ workId }: { workId: string }) {
  const { works, save } = useVersionPrototype();
  const work = validDemoWorkId(workId) ? works.find((item) => item.workId === workId) : undefined;
  const [actor, setActor] = useState<string>(DEMO_WALLETS[0]);
  const [selectedHash, setSelectedHash] = useState(DEMO_PROOFS[0].fileHash);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fingerprint, setFingerprint] = useState<FileFingerprint | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  if (!work) return <div className="rounded-2xl border border-white/10 p-6"><h1 className="text-xl font-semibold">Local demo unavailable</h1><p className="mt-3 text-sm leading-6 text-zinc-400">This work is not stored in this browser and site origin, or the ID is invalid. It is not a publicly published on-chain work.</p><Link href="/works" className="mt-5 inline-block text-sm underline underline-offset-4">Return to demo works</Link></div>;
  const match = fingerprint ? findDemoFileVersion(work, fingerprint.hash) : null;
  const targetVersion = target ? work.versions.find((item) => item.versionId === target) : null;
  function append(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    try {
      const next = appendDemoVersion(work as DemoWork, { actor, fileHash: selectedHash, versionLabel: label, expectedPreviousVersionId: work!.versions.at(-1)?.versionId ?? null, now: Math.floor(Date.now() / 1000) });
      save(next); setLabel(""); setNotice("Version linked locally. No blockchain record was created.");
    } catch (cause) { setError(message(cause)); }
  }
  return <>
    <p className="text-xs uppercase tracking-[0.12em] text-amber-300">User-provided · Local demo</p>
    <h1 className="mt-3 break-words text-3xl font-semibold tracking-tight sm:text-4xl">{work.title}</h1>
    {work.description && <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-zinc-400">{work.description}</p>}
    <dl className="mt-6 grid min-w-0 gap-5 rounded-xl border border-white/10 p-5 sm:grid-cols-2"><div><dt className="text-xs text-zinc-500">Local Work ID</dt><dd className="mt-2 break-all font-mono text-xs text-zinc-300">{work.workId}</dd></div><div><dt className="text-xs text-zinc-500">Simulated controller / creator</dt><dd className="mt-2 break-all font-mono text-xs text-zinc-300">{work.controller}</dd></div><div><dt className="text-xs text-zinc-500">Created locally (device clock)</dt><dd className="mt-2 text-sm text-zinc-300">{date(work.createdAt)}</dd></div><div><dt className="text-xs text-zinc-500">Sharing</dt><dd className="mt-2 text-sm text-zinc-400">Local URL only; unavailable on another device.</dd></div></dl>
    <section aria-label="Demo version timeline" className="mt-10">
      <h2 className="text-xl font-semibold">Version timeline · Demo</h2>
      <p className="mt-3 text-xs leading-6 text-zinc-400">Numbers describe local append order. Labels are user-provided. Fixture registration times may differ from append order; neither proves creation order.</p>
      {!work.versions.length && <p className="mt-6 text-sm text-zinc-500">No versions yet. Add a demo proof below.</p>}
      <ol className="mt-6 space-y-6 border-l border-white/15 pl-4 sm:pl-6">{work.versions.map((version) => <li key={version.versionId} data-testid="demo-version" className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6"><p className="text-xs text-amber-300">Demo proof · Local association only</p><h3 className="mt-3 text-lg font-semibold">Version {version.versionNumber}</h3>{version.versionLabel && <p className="mt-2 break-words text-sm text-zinc-300">User label: {version.versionLabel}</p>}<p className="mt-4 select-all break-all font-mono text-xs leading-6 text-zinc-300">{version.fileHash}</p><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-xs text-zinc-500">Registered · Synthetic fixture</dt><dd className="mt-1 text-zinc-300">{date(version.registeredTimestamp)}</dd></div><div><dt className="text-xs text-zinc-500">Associated locally · Device time</dt><dd className="mt-1 text-zinc-300">{date(version.associationTimestamp)}</dd></div><div className="sm:col-span-2"><dt className="text-xs text-zinc-500">Registered Wallet · Simulated</dt><dd className="mt-1 break-all font-mono text-xs text-zinc-300">{version.registeredWallet}</dd></div></dl><div className="mt-5 flex flex-wrap items-start gap-3"><CopyHash hash={version.fileHash} /><a href="#verify-demo" onClick={() => { setTarget(version.versionId); setFingerprint(null); }} className={secondaryClass}>Verify File</a></div><details className="mt-4 text-xs leading-6 text-zinc-400"><summary className="cursor-pointer text-zinc-300">View Proof (demo)</summary><p className="mt-3">Synthetic fixture only. This is not a mainnet certificate.</p><p className="mt-2 break-all">Version ID: {version.versionId}</p><p className="break-all">Previous: {version.previousVersionId ?? "None / first local version"}</p><p className="mt-3">Sample file bytes (UTF-8; includes a final newline):</p><pre className="mt-2 whitespace-pre-wrap break-all rounded-lg border border-white/10 p-3">{DEMO_PROOFS.find((proof) => proof.fileHash === version.fileHash)?.content}</pre></details></li>)}</ol>
    </section>
    <form onSubmit={append} className="mt-10 rounded-2xl border border-white/10 p-5 sm:p-6">
      <h2 className="text-xl font-semibold">Add a demo version</h2>
      <p className="mt-3 text-xs leading-6 text-zinc-400">Simulated rule: actor, work controller and original fixture wallet must agree. Collaboration is not enabled. A fingerprint can appear once per work.</p>
      <div className="mt-5 grid gap-5 sm:grid-cols-2"><label className="text-sm text-zinc-300">Simulated acting wallet<select aria-label="Simulated acting wallet" value={actor} onChange={(event) => setActor(event.target.value)} className={inputClass}><option value={DEMO_WALLETS[0]}>Demo wallet A (…0002)</option><option value={DEMO_WALLETS[1]}>Demo wallet B (…0003)</option></select></label><label className="text-sm text-zinc-300">Demo proof fixture<select aria-label="Demo proof fixture" value={selectedHash} onChange={(event) => setSelectedHash(event.target.value)} className={inputClass}>{DEMO_PROOFS.map((proof) => <option key={proof.fileHash} value={proof.fileHash}>{proof.name}</option>)}</select></label></div>
      <label className="mt-5 block text-sm text-zinc-300">Version label · User-provided (optional)<input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={60} placeholder="e.g. Second draft" className={inputClass} /></label>
      <button type="submit" className={`${buttonClass} mt-5`}>Append demo version</button>
      {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}{notice && <p role="status" className="mt-4 text-sm text-amber-200">{notice}</p>}
    </form>
    <section id="verify-demo" className="mt-10 rounded-2xl border border-white/10 p-5 sm:p-6">
      <h2 className="text-xl font-semibold">Verify File · Local demo comparison</h2>
      <p className="mt-3 text-sm leading-6 text-zinc-400">Compare local bytes {targetVersion ? `with demo version ${targetVersion.versionNumber}` : "against this demo timeline"}. A match here is not a mainnet verification. Your file is neither uploaded nor stored.</p>
      {target && <button type="button" onClick={() => { setTarget(null); setFingerprint(null); }} className={`${secondaryClass} mt-3`}>Compare all demo versions</button>}
      <div className="mt-5"><FilePicker key={target ?? "all"} onChange={setFingerprint} /></div>
      {fingerprint && <p role="status" className={`mt-5 text-sm ${match && (!target || match.versionId === target) ? "text-amber-200" : "text-zinc-300"}`}>{match && (!target || match.versionId === target) ? `Demo byte match · Version ${match.versionNumber}. No on-chain relationship has been verified.` : "No demo byte match. This result does not determine mainnet registration."}</p>}
    </section>
    <MainnetCompatibilityPanel />
  </>;
}
