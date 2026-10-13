"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { type Address, type Hex } from "viem";
import { localHost, validateLocalDeployment, type LocalDeployment } from "@/lib/local-evm-safety";
import { checkLocalDeployment, confirmLocalReceipt, localAccounts, localClient, localError, readLocalProof, readLocalWork, readVersionPage, scanLocalWorks, sendLocal, type LocalVersion } from "@/lib/local-version-registry";

type Intent = { kind: "create"; hash: Hex } | { kind: "add"; id: bigint; hash: Hex; previous: bigint };
type Work = Awaited<ReturnType<typeof readLocalWork>>;
const button = "rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-40 disabled:cursor-not-allowed";
const secondary = "rounded-xl border border-white/15 px-4 py-2 text-sm text-zinc-300";
const input = "mt-2 block w-full min-w-0 rounded-xl border border-white/15 bg-[#14161b] px-4 py-3 text-sm outline-none";
function time(value: bigint) { return new Date(Number(value) * 1000).toISOString().replace("T", " ").slice(0, 19) + " UTC"; }

export default function LocalVersionHistory({ mode, workId }: { mode: "list" | "new" | "detail"; workId?: string }) {
  const router = useRouter();
  const [config, setConfig] = useState<LocalDeployment | null>(null);
  const [environmentError, setEnvironmentError] = useState("");
  const [account, setAccount] = useState<Address | null>(null);
  const [chosen, setChosen] = useState("");
  const [hash, setHash] = useState("");
  const [retry, setRetry] = useState(0);
  const [ids, setIds] = useState<bigint[]>([]);
  const [scan, setScan] = useState("Wallet Disconnected");
  const [progress, setProgress] = useState("");
  const [work, setWork] = useState<Work | null>(null);
  const [versions, setVersions] = useState<LocalVersion[]>([]);
  const [pageBusy, setPageBusy] = useState(false);
  const [state, setState] = useState("");
  const [error, setError] = useState("");
  const [candidate, setCandidate] = useState<{ owner: Address; registered: bigint } | null>(null);
  const [candidateState, setCandidateState] = useState("");
  const [confirm, setConfirm] = useState<{ intent: Intent; owner: Address } | null>(null);
  const [tx, setTx] = useState<Hex | null>(null);
  const [pending, setPending] = useState<{ transaction: Hex; intent: Intent; owner: Address } | null>(null);
  const mounted = useRef(true);
  const epoch = useRef(0);
  const connectionRequest = useRef(0);
  const locked = useRef(false);
  const approving = useRef(false);
  const receiptBusy = useRef(false);
  const wallet = useRef<Address | null>(null);
  wallet.current = account;
  const id = workId && /^[1-9][0-9]{0,77}$/.test(workId) && BigInt(workId) < BigInt(2) ** BigInt(256) ? BigInt(workId) : null;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; epoch.current++; connectionRequest.current++; }; }, []);
  useEffect(() => {
    let active = true; setEnvironmentError(""); setConfig(null);
    void (async () => {
      if (!localHost(window.location.hostname)) throw new Error("Local development requires a loopback website.");
      const response = await fetch("/local-evm/config", { cache: "no-store" });
      if (!response.ok) throw new Error("Contract Not Deployed");
      const deployment = validateLocalDeployment(await response.json());
      await checkLocalDeployment(deployment);
      if (active) { setConfig(deployment); setChosen(deployment.accounts[0]); setHash(deployment.samples[0]?.hash ?? ""); }
    })().catch((cause) => { if (active) setEnvironmentError(localError(cause)); });
    return () => { active = false; };
  }, [retry]);

  useEffect(() => {
    const request = ++epoch.current;
    const active = () => mounted.current && epoch.current === request;
    setWork(null); setVersions([]); setError(""); setCandidate(null); setIds([]);
    if (!config) return;
    if (mode === "detail") {
      if (!id) { setState("Work Not Found"); return; }
      setState("Loading Work");
      void (async () => {
        await checkLocalDeployment(config);
        const current = await readLocalWork(config, id);
        const timeline = await readVersionPage(config, id, BigInt(1), current.versionCount, current.controller);
        if (!active()) return;
        setWork(current); setVersions(timeline); setState("Local Work Loaded");
      })().catch((cause) => { if (active()) { setState(localError(cause)); setError(localError(cause)); } });
    } else if (mode === "list") {
      if (!account) { setScan("Wallet Disconnected"); return; }
      setScan("Scanning"); setProgress("");
      void scanLocalWorks(config, account, () => !active(), (found, block) => {
        if (active()) { setIds((current) => [...current, ...found]); setProgress(`Scanned through local block ${block}`); }
      }).then((complete) => { if (active() && complete) setScan("Scan Complete"); }).catch((cause) => { if (active()) { setScan("Scan Failed / Partial Results"); setError(localError(cause)); } });
    }
    return () => { epoch.current++; };
  }, [config, account, mode, workId]);

  useEffect(() => {
    let active = true;
    setCandidate(null); setCandidateState("");
    if (!config || !/^0x[0-9a-fA-F]{64}$/.test(hash) || mode === "list") return;
    setCandidateState("Checking Original Proof");
    void (async () => {
      await checkLocalDeployment(config);
      const [owner, registered, exists] = await readLocalProof(config, hash.toLowerCase() as Hex);
      if (!active) return;
      if (!exists || registered === BigInt(0)) { setCandidateState("Original Proof Not Found"); return; }
      setCandidate({ owner, registered });
      if (!account) setCandidateState("Wallet Disconnected");
      else if (owner.toLowerCase() !== account.toLowerCase() || (mode === "detail" && work?.controller.toLowerCase() !== account.toLowerCase())) setCandidateState("Unauthorized Wallet");
      else if (versions.some((version) => version.fileHash === hash.toLowerCase())) setCandidateState("Duplicate Hash");
      else setCandidateState(mode === "new" ? "Ready to Create" : "Ready to Add Version");
    })().catch((cause) => { if (active) setCandidateState(localError(cause)); });
    return () => { active = false; };
  }, [config, hash, account, mode, work, versions]);

  async function connect() {
    if (!config) return;
    const request = ++connectionRequest.current;
    const active = () => mounted.current && connectionRequest.current === request;
    try {
      await checkLocalDeployment(config);
      const accounts = await localAccounts();
      if (!active()) return;
      if (!accounts.some((item) => item.toLowerCase() === chosen.toLowerCase())) throw new Error("Wallet Disconnected");
      setAccount(chosen as Address); setError("");
    } catch (cause) { if (active()) setError(localError(cause)); }
  }
  function disconnect(next: string | null) {
    connectionRequest.current++; epoch.current++; wallet.current = null;
    setAccount(null); setIds([]); setWork(null); setVersions([]); setConfirm(null); setCandidate(null);
    // A pending preflight retains its lock until its invalidated request finishes.
    if (!pending && !approving.current) { locked.current = false; setState(""); }
    if (next) setChosen(next);
  }
  function requestTransaction() {
    if (!config || !account || locked.current || approving.current || pending || !candidateState.startsWith("Ready") || (mode === "detail" && (!id || !work))) return;
    locked.current = true; setError(""); setTx(null); setState("Awaiting Wallet Confirmation");
    setConfirm({ owner: account, intent: mode === "new" ? { kind: "create", hash: hash.toLowerCase() as Hex } : { kind: "add", id: id!, hash: hash.toLowerCase() as Hex, previous: work!.versionCount } });
  }
  async function waitReceipt(details: NonNullable<typeof pending>) {
    if (!config || receiptBusy.current) return;
    receiptBusy.current = true;
    setState("Waiting for Receipt");
    try {
      await checkLocalDeployment(config);
      const receipt = await localClient.waitForTransactionReceipt({ hash: details.transaction, timeout: 20000 });
      const event = confirmLocalReceipt(receipt, config, details.owner, details.intent.hash);
      if (details.intent.kind === "add" && (event.workId !== details.intent.id || event.previousVersionNumber !== details.intent.previous || event.versionNumber !== details.intent.previous + BigInt(1))) throw new Error("Unexpected receipt");
      if (details.intent.kind === "create" && (event.versionNumber !== BigInt(1) || event.previousVersionNumber !== BigInt(0))) throw new Error("Unexpected receipt");
      if (!mounted.current) return;
      setPending(null); locked.current = false;
      setState(details.intent.kind === "create" ? "Work Created" : "Version Added");
      if (details.intent.kind === "create") router.push(`/local-evm/works/${event.workId}`);
      else {
        const stamp = epoch.current;
        try {
          const refreshed = await readLocalWork(config, details.intent.id);
          const timeline = await readVersionPage(config, details.intent.id, BigInt(1), refreshed.versionCount, refreshed.controller);
          if (mounted.current && epoch.current === stamp) { setWork(refreshed); setVersions(timeline); }
        } catch (cause) {
          if (mounted.current && epoch.current === stamp) { setWork(null); setVersions([]); setError(`Version Added, but timeline refresh failed. ${localError(cause)}`); }
        }
      }
    } catch (cause) {
      if (!mounted.current) return;
      if ((cause as Error).message === "Transaction Reverted") { setPending(null); locked.current = false; }
      setState((cause as Error).message === "Transaction Reverted" ? "Transaction Reverted" : "Transaction confirmation unavailable"); setError(localError(cause));
    } finally { receiptBusy.current = false; }
  }
  async function approve() {
    if (!confirm || !config || approving.current) return;
    approving.current = true;
    const stamp = epoch.current;
    const request = confirm; setConfirm(null);
    try {
      if (wallet.current?.toLowerCase() !== request.owner.toLowerCase()) throw new Error("Wallet Disconnected");
      const transaction = await sendLocal(config, request.owner, request.intent, () => mounted.current && epoch.current === stamp && wallet.current?.toLowerCase() === request.owner.toLowerCase());
      if (!mounted.current) return;
      const details = { transaction, intent: request.intent, owner: request.owner };
      setTx(transaction); setPending(details); setState("Transaction Submitted"); await waitReceipt(details);
    } catch (cause) { if (mounted.current) { locked.current = false; setState("Transaction Rejected / Network Error"); setError(localError(cause)); } }
    finally { approving.current = false; }
  }
  async function more() {
    if (!config || !id || !work || pageBusy) return;
    const stamp = epoch.current; setPageBusy(true);
    try { await checkLocalDeployment(config); const next = await readVersionPage(config, id, BigInt(versions.length + 1), work.versionCount, work.controller); if (mounted.current && epoch.current === stamp) setVersions((current) => [...current, ...next]); }
    catch (cause) { if (mounted.current && epoch.current === stamp) setError(localError(cause)); }
    finally { if (mounted.current) setPageBusy(false); }
  }

  return <div className="w-full min-w-0 max-w-4xl self-center py-10 sm:py-16">
    <aside className="rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] p-5 text-sm leading-6"><p className="font-semibold text-amber-300">LOCAL EVM DEVELOPMENT</p><p className="mt-2 text-amber-200">NOT DEPLOYED TO BOT CHAIN MAINNET</p><p className="mt-2 text-zinc-400">Source: actual isolated Hardhat chain 31337. No BOT is spent. The wallet below uses unlocked local development accounts and never accesses MetaMask, private keys or seed phrases. Do not fund these accounts.</p><p className="mt-2 text-xs text-zinc-400">The main navigation wallet belongs to the existing mainnet product. No network is switched by this local module.</p></aside>
    <nav aria-label="Local EVM navigation" className="my-6 flex flex-wrap gap-5 text-sm text-zinc-300"><Link href="/local-evm/works">Local works</Link><Link href="/local-evm/works/new">Create local work</Link><Link href="/works">Prototype / Demo</Link><Link href="/">Mainnet product</Link></nav>
    <h1 className="text-3xl font-semibold">{mode === "list" ? "Local EVM Works" : mode === "new" ? "Create Local Work" : `Local Work ${workId}`}</h1>
    <div className="mt-6 rounded-xl border border-white/10 p-5"><p className="text-sm text-zinc-300">{account ? "Local Test Wallet Connected" : "Wallet Disconnected"}</p>{config && <><label className="mt-4 block text-sm text-zinc-400">Unlocked local development account<select aria-label="Unlocked local development account" className={`${input} font-mono`} value={chosen} disabled={Boolean(confirm)} onChange={(event) => disconnect(event.target.value)}>{config.accounts.map((address, index) => <option key={address} value={address}>Local account {index + 1} · {address.slice(0, 8)}…{address.slice(-4)}</option>)}</select></label><p className="mt-3 break-all font-mono text-xs text-zinc-400">{account ?? chosen}</p><div className="mt-4 flex flex-wrap gap-3"><button type="button" className={secondary} onClick={() => void connect()} disabled={Boolean(account)}>Connect Local Test Wallet</button><button type="button" className={secondary} onClick={() => disconnect(null)}>Disconnect Local Wallet</button></div><p className="mt-4 break-all text-xs text-zinc-500">Local old registry: {config.original}<br />Local V2 registry: {config.registry}</p></>}</div>
    {environmentError && <p role="alert" className="mt-5 text-sm text-red-300">{environmentError}</p>}
    {!config && !environmentError && <p role="status" className="mt-5 text-sm text-zinc-400">Checking Local RPC and deployed contracts…</p>}
    {config && mode === "list" && <section className="mt-8"><p role="status" className="text-sm text-zinc-300">{scan}{scan === "Scanning" && ids.length > 0 ? " · Partial Results" : ""}</p><p className="mt-2 text-xs text-zinc-500">{progress}</p><ul className="mt-6 space-y-3">{ids.map((value) => <li key={value.toString()} className="rounded-xl border border-white/10 p-4"><Link href={`/local-evm/works/${value}`} className="text-sm underline underline-offset-4">Local Work {value.toString()}</Link><p className="mt-2 text-xs text-zinc-500">Source: WorkCreated event from the local V2 contract.</p></li>)}</ul>{scan === "Scan Complete" && !ids.length && <p className="mt-4 text-sm text-zinc-400">No local works found for this wallet in the completed scan.</p>}</section>}
    {config && mode === "detail" && <section className="mt-8"><p role="status" className="text-sm text-zinc-300">{state}</p>{work && <><dl className="mt-5 grid gap-5 rounded-xl border border-white/10 p-5 sm:grid-cols-2"><div><dt className="text-xs text-zinc-500">Controller Wallet · Local V2 storage</dt><dd className="mt-2 break-all font-mono text-xs">{work.controller}</dd></div><div><dt className="text-xs text-zinc-500">Work Creation Time · Local block</dt><dd className="mt-2 text-sm">{time(work.createdAt)}</dd></div><div><dt className="text-xs text-zinc-500">Version Count · Local V2 storage</dt><dd data-testid="local-version-count" className="mt-2 text-sm">{work.versionCount.toString()}</dd></div></dl><ol className="mt-8 space-y-5 border-l border-white/15 pl-4">{versions.map((entry) => <li key={entry.number.toString()} data-testid="local-version" className="min-w-0 rounded-xl border border-white/10 p-5"><h2 className="text-lg font-semibold">Local Version {entry.number.toString()}</h2><p className="mt-2 text-xs text-amber-300">Local EVM records only · no mainnet certificate</p><p className="mt-4 select-all break-all font-mono text-xs leading-6">{entry.fileHash}</p><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-zinc-500">Original Registration Time · Local old contract</dt><dd className="mt-1">{time(entry.registeredAt)}</dd></div><div><dt className="text-zinc-500">Version Association Time · Local V2 contract</dt><dd className="mt-1">{time(entry.associatedAt)}</dd></div><div><dt className="text-zinc-500">Original Registered Wallet · Local old contract</dt><dd className="mt-1 break-all font-mono text-xs">{entry.owner}</dd></div><div><dt className="text-zinc-500">Previous version number · Local V2 storage</dt><dd className="mt-1">{entry.previousVersionNumber.toString()}{entry.previousVersionNumber === BigInt(0) ? " (first version)" : ""}</dd></div></dl></li>)}</ol>{versions.length < Number(work.versionCount) && <button type="button" className={`${secondary} mt-5`} onClick={() => void more()} disabled={pageBusy}>Load next 10 local versions</button>}</>}</section>}
    {config && (mode === "new" || (mode === "detail" && work)) && <section className="mt-8 rounded-xl border border-white/10 p-5"><h2 className="text-xl font-semibold">{mode === "new" ? "Create work + Version 1 atomically" : `Add Version ${work ? (work.versionCount + BigInt(1)).toString() : ""}`}</h2><p className="mt-3 text-xs leading-6 text-zinc-400">Hash must be registered by your wallet in the local original contract. No title, description or claimed creation date is saved on-chain.</p><label className="mt-5 block text-sm text-zinc-300">Local registered file hash<input aria-label="Local registered file hash" value={hash} onChange={(event) => setHash(event.target.value)} maxLength={66} spellCheck={false} className={`${input} font-mono`} disabled={Boolean(confirm || pending)} /></label><label className="mt-4 block text-xs text-zinc-400">Prepared local files<select aria-label="Prepared local files" className={input} value={config.samples.some((sample) => sample.hash === hash) ? hash : ""} onChange={(event) => setHash(event.target.value)} disabled={Boolean(confirm || pending)}><option value="">Custom hash</option>{config.samples.map((sample) => <option key={sample.hash} value={sample.hash}>{sample.name}{sample.owner.toLowerCase() !== config.accounts[0].toLowerCase() ? " / account 2" : " / account 1"}</option>)}</select></label><p role="status" className="mt-4 text-sm text-amber-200">{candidateState || "Enter a valid bytes32 hash"}</p>{candidate && <p className="mt-3 break-all text-xs leading-6 text-zinc-400">Source: local old getProof. Registered wallet: {candidate.owner}<br />Original Registration Time: {time(candidate.registered)}</p>}<button type="button" onClick={requestTransaction} disabled={!candidateState.startsWith("Ready") || Boolean(confirm || pending) || locked.current} className={`${button} mt-5`}>{mode === "new" ? "Create Work" : "Add Version"}</button></section>}
    {confirm && <div role="dialog" aria-modal="true" aria-label="Local wallet transaction confirmation" className="mt-6 rounded-xl border border-amber-300/40 bg-[#171a1e] p-6"><h2 className="text-lg font-semibold">Awaiting Wallet Confirmation · Local only</h2><p className="mt-3 break-all text-sm leading-6 text-zinc-300">Chain 31337 · {config?.rpcUrl}<br />Wallet: {confirm.owner}<br />Contract: {config?.registry}<br />Hash: {confirm.intent.hash}</p><p className="mt-3 text-xs text-zinc-400">This executes an actual local EVM transaction using an unlocked development account. No MetaMask signature or BOT fee.</p><div className="mt-5 flex flex-wrap gap-3"><button type="button" className={button} onClick={() => void approve()}>Confirm Local Transaction</button><button type="button" className={secondary} onClick={() => { setConfirm(null); locked.current = false; setState("Transaction Rejected"); setError("Transaction Rejected. Nothing was sent."); }}>Reject Local Transaction</button></div></div>}
    {tx && <div className="mt-5 rounded-xl border border-white/10 p-5"><p role="status" className="text-sm text-zinc-300">{state}</p><p className="mt-2 text-xs text-zinc-500">Transaction Hash · Local chain only</p><p className="mt-2 break-all font-mono text-xs">{tx}</p><p className="mt-3 text-xs text-zinc-500">No BOTScan link: this transaction does not exist on BOT Chain Mainnet. After refresh, the work is reconstructed from local contracts, not browser storage.</p>{pending && <button type="button" className={`${secondary} mt-3`} onClick={() => void waitReceipt(pending)}>Retry Local Receipt</button>}</div>}
    {error && <p role="alert" className="mt-5 text-sm text-red-300">{error}</p>}
    <button type="button" className={`${secondary} mt-6`} onClick={() => setRetry((value) => value + 1)} disabled={Boolean(confirm || pending)}>Retry / Refresh Local Data</button>
    <p className="mt-8 text-xs leading-6 text-zinc-500">Version order proves association order only. A registered wallet does not establish real identity, copyright or originality. The same warning applies if someone registered another person&apos;s public file first.</p>
  </div>;
}
