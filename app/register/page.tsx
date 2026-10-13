"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createWalletClient, custom, type Address, type Hex } from "viem";
import FilePicker from "@/components/file-picker";
import PrivacyNote from "@/components/privacy-note";
import { useWallet } from "@/components/wallet-provider";
import { BOTSCAN_URL, CHAIN_PROOF_ADDRESS, botChainMainnet, chainProofAbi, publicClient, readProof, receiptRegistersProof, toFileHashBytes32 } from "@/lib/chainproof";
import { PROOF_TYPES, type FileFingerprint, type ProofType } from "@/lib/proof";
import { parsePendingRegistration, type PendingRegistration } from "@/lib/registration";
import { friendlyChainError, WalletFlowError } from "@/lib/wallet";

type CreatedProof = { creator: Address; hash: string; transaction: Hex };
type ExistingProof = { hash: string; owner: Address; timestamp: bigint };
type Phase = "idle" | "wallet" | "checking" | "confirming" | "submitted" | "receipt";
const PENDING_KEY = `chainproof:pending:${botChainMainnet.id}:${CHAIN_PROOF_ADDRESS.toLowerCase()}`;

export default function RegisterPage() {
  const [fingerprint, setFingerprint] = useState<FileFingerprint | null>(null);
  const [fileStatus, setFileStatus] = useState("idle");
  const [title, setTitle] = useState("");
  const [proofType, setProofType] = useState<ProofType>("AI Content");
  const [phase, setPhase] = useState<Phase>("idle");
  const [created, setCreated] = useState<CreatedProof | null>(null);
  const [existingProof, setExistingProof] = useState<ExistingProof | null>(null);
  const [checkedHash, setCheckedHash] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [lookupRetry, setLookupRetry] = useState(0);
  const [submittedTransaction, setSubmittedTransaction] = useState<Hex | null>(null);
  const [pending, setPending] = useState<PendingRegistration | null>(null);
  const [recoveryAvailable, setRecoveryAvailable] = useState(true);
  const [confirmationRetry, setConfirmationRetry] = useState(0);
  const [error, setError] = useState("");
  const { connect, address, chainId, metaMaskAvailable } = useWallet();
  const wallet = useRef({ address, chainId });
  wallet.current = { address, chainId };
  const locked = useRef(false);
  const mounted = useRef(true);
  const loading = phase !== "idle";
  const checkingFile = Boolean(fingerprint && checkedHash !== fingerprint.hash && !lookupError);
  const currentProof = existingProof?.hash === fingerprint?.hash ? existingProof : null;

  function savePending(next: PendingRegistration | null) {
    try { if (next) sessionStorage.setItem(PENDING_KEY, JSON.stringify(next)); else sessionStorage.removeItem(PENDING_KEY); } catch { if (mounted.current) setRecoveryAvailable(false); }
  }

  useEffect(() => {
    mounted.current = true;
    try {
      const stored = parsePendingRegistration(JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null"), botChainMainnet.id, CHAIN_PROOF_ADDRESS);
      if (stored) { locked.current = true; setPending(stored); setSubmittedTransaction(stored.transaction); }
    } catch { setRecoveryAvailable(false); }
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!fingerprint) return;
    const hash = fingerprint.hash;
    let active = true;
    setLookupError("");
    setCheckedHash(null);
    void readProof(hash).then(([owner, timestamp, exists]) => {
      if (!active) return;
      setExistingProof(exists ? { hash, owner, timestamp } : null);
      setCheckedHash(hash);
    }).catch(() => { if (active) setLookupError("Could not check existing registration. Please retry before creating a proof."); });
    return () => { active = false; };
  }, [fingerprint, lookupRetry]);

  useEffect(() => {
    if (!pending) return;
    let active = true;
    let cancelled = false;
    setPhase("receipt");
    setError("");
    void publicClient.getChainId().then((network) => {
      if (!active) throw new Error("Receipt check stopped.");
      if (network !== botChainMainnet.id) throw new Error("Unexpected receipt network.");
      return publicClient.waitForTransactionReceipt({
      hash: pending.transaction, timeout: 120_000,
      onReplaced: ({ reason, transactionReceipt }) => {
        if (!active) return;
        cancelled = reason === "cancelled";
        setSubmittedTransaction(transactionReceipt.transactionHash);
        savePending({ ...pending, transaction: transactionReceipt.transactionHash });
      },
      });
    }).then(async (receipt) => {
      if (!active) return;
      if (cancelled || receipt.status !== "success") {
        setError(cancelled ? "Transaction was cancelled." : "Transaction failed on BOT Chain. No registration was confirmed.");
        if (!cancelled) {
          try { const [owner, timestamp, exists] = await readProof(pending.hash); if (active && exists) setExistingProof({ hash: pending.hash, owner, timestamp }); } catch { /* A failed receipt is never treated as a successful proof. */ }
        }
      } else if (!receiptRegistersProof(receipt, toFileHashBytes32(pending.hash), pending.owner)) {
        setError("This transaction did not create the requested proof.");
      } else {
        setCreated({ creator: pending.owner, hash: pending.hash, transaction: receipt.transactionHash });
      }
      if (!active) return;
      savePending(null);
      setPending(null);
      locked.current = false;
      setPhase("idle");
    }).catch(() => {
      if (!active) return;
      setError("Transaction submitted, but confirmation is unavailable. Check BOTScan or retry the receipt check. Do not submit it again.");
      setPhase("idle");
    });
    return () => { active = false; };
  }, [pending, confirmationRetry]);

  function handleFileChange(next: FileFingerprint | null) {
    if (pending) return;
    setFingerprint(next); setCreated(null); setExistingProof(null); setCheckedHash(null);
    setLookupError(""); setSubmittedTransaction(null); setError("");
  }

  async function register() {
    if (!fingerprint || locked.current || loading || checkingFile || lookupError || currentProof || created || pending) return;
    locked.current = true;
    const hash = fingerprint.hash;
    setPhase("wallet"); setError(""); setSubmittedTransaction(null);
    let submitted = false;
    try {
      const { account, provider } = await connect();
      if (!mounted.current) return;
      setPhase("checking");
      const [owner, timestamp, exists] = await readProof(hash);
      if (!mounted.current) return;
      if (exists) { setExistingProof({ hash, owner, timestamp }); return; }
      const [accounts, network] = await Promise.all([provider.request({ method: "eth_accounts" }), provider.request({ method: "eth_chainId" })]);
      if (!mounted.current) return;
      if (accounts[0]?.toLowerCase() !== account.toLowerCase() || wallet.current.address?.toLowerCase() !== account.toLowerCase() || Number(network) !== botChainMainnet.id || wallet.current.chainId !== botChainMainnet.id) {
        throw new WalletFlowError("Wallet or network changed. Review your selection and try again.");
      }
      setPhase("confirming");
      const walletClient = createWalletClient({ account, chain: botChainMainnet, transport: custom(provider) });
      const transaction = await walletClient.writeContract({ address: CHAIN_PROOF_ADDRESS, abi: chainProofAbi, functionName: "registerProof", args: [toFileHashBytes32(hash)] });
      const next = { hash, owner: account, transaction, chainId: botChainMainnet.id, contract: CHAIN_PROOF_ADDRESS };
      // Save after wallet submission, even if the user navigated away during the prompt.
      savePending(next); submitted = true;
      if (!mounted.current) return;
      setSubmittedTransaction(transaction); setPhase("submitted"); setPending(next);
    } catch (cause) {
      if (mounted.current) setError(friendlyChainError(cause));
    } finally {
      if (!submitted) { locked.current = false; if (mounted.current) setPhase("idle"); }
    }
  }

  const status = created ? "Registration Included" : pending ? phase === "receipt" ? "Waiting for Receipt" : "Transaction Submitted" : phase === "wallet" ? "Connecting Wallet" : phase === "checking" || checkingFile ? "Checking Existing Proof" : phase === "confirming" ? "Awaiting Wallet Confirmation" : currentProof ? "Already Registered" : error ? "Transaction Rejected / Failed" : lookupError ? "Registration Check Error" : fileStatus === "hashing" ? "Calculating SHA-256" : fileStatus === "error" ? "File Read Error" : fingerprint ? "Ready to Register" : "No File Selected";
  const txOwner = pending?.owner ?? created?.creator;
  return <div className="w-full max-w-3xl self-center py-12 sm:py-20">
    <Link href="/" className="text-sm text-zinc-500 hover:text-white">← Back to home</Link>
    <div className="mt-9"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">01 / Create proof</p><h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Create Proof</h1><p className="mt-4 text-sm leading-7 text-zinc-400">Choose a file to register its fingerprint on BOT Chain Mainnet. The file stays on your device.</p></div>
    <div className="mt-8 rounded-xl border border-white/10 p-5"><p className="text-xs leading-6 text-zinc-400">Optional screen labels only. Title and Proof Type are not stored on-chain, saved after a refresh, or included in the certificate.</p><div className="mt-4 grid gap-5 sm:grid-cols-2">
      <label className="text-sm text-zinc-300">Title (optional)<input type="text" value={title} maxLength={120} disabled={loading || Boolean(pending)} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Final research report" className="mt-2 block w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-white/50" /></label>
      <label className="text-sm text-zinc-300">Proof Type<select value={proofType} disabled={loading || Boolean(pending)} onChange={(event) => setProofType(event.target.value as ProofType)} className="mt-2 block w-full rounded-xl border border-white/15 bg-[#14161b] px-4 py-3 text-sm text-white outline-none">{PROOF_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
    </div></div>
    <div className="mt-6"><FilePicker onChange={handleFileChange} onStatusChange={setFileStatus} disabled={loading || Boolean(pending)} /></div>
    <div role="status" className="mt-6 rounded-xl border border-white/10 bg-white/[0.025] p-4 text-sm"><p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Registration Status</p><p className="mt-2 font-medium text-zinc-200">{status}</p></div>
    <p className="mt-5 text-xs leading-6 text-zinc-400">This action writes a record to BOT Chain Mainnet and requires a network transaction fee.</p>
    <button type="button" disabled={!fingerprint || loading || checkingFile || Boolean(lookupError || currentProof || created || pending) || metaMaskAvailable === false} onClick={() => void register()} className="mt-4 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40">{loading ? status : "Create Proof"}</button>
    {metaMaskAvailable === false && <p className="mt-3 text-sm text-amber-300">MetaMask is required to create a proof. You can still verify files and view public certificates.</p>}
    {lookupError && <div className="mt-5 text-sm text-red-300"><p>{lookupError}</p><button type="button" onClick={() => setLookupRetry((value) => value + 1)} className="mt-3 underline underline-offset-4">Retry registration check</button></div>}
    <div aria-live="polite">
      {currentProof && <div className="mt-6 rounded-xl border border-amber-400/25 bg-amber-400/10 p-5 text-sm"><p className="font-medium text-amber-300">A provenance proof for this file already exists on BOT Chain.</p><dl className="mt-4 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs text-zinc-400">Registered Wallet</dt><dd className="mt-1 break-all font-mono text-zinc-300">{currentProof.owner}</dd></div><div><dt className="text-xs text-zinc-400">Registration Time</dt><dd className="mt-1 text-zinc-300">{new Date(Number(currentProof.timestamp) * 1000).toLocaleString()}</dd></div></dl><Link href={`/proof/0x${currentProof.hash}`} className="mt-5 inline-block text-zinc-200 underline underline-offset-4">View Certificate</Link></div>}
      {created && <div className="mt-6 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-5 text-sm"><h2 className="font-semibold text-emerald-300">Registration Included</h2><p className="mt-3 leading-6 text-zinc-300">A successful transaction receipt includes the requested registration. This is not a guarantee of chain finality.</p><dl className="mt-4 space-y-3 text-zinc-300"><div><dt className="text-xs text-zinc-400">Registered Wallet</dt><dd className="mt-1 break-all font-mono">{created.creator}</dd></div><div><dt className="text-xs text-zinc-400">File Fingerprint</dt><dd className="mt-1 break-all font-mono">{created.hash}</dd></div></dl><div className="mt-5 flex flex-wrap gap-4"><Link href={`/proof/0x${created.hash}`} className="text-emerald-300 underline underline-offset-4">View Certificate</Link><Link href="/my-proofs" className="text-zinc-300 underline underline-offset-4">View My Proofs</Link></div></div>}
      {submittedTransaction && <div className="mt-5 rounded-xl border border-white/10 p-5 text-sm"><p className="text-zinc-400">Transaction Submitted</p><p className="mt-2 break-all font-mono text-zinc-300">{submittedTransaction}</p><a href={`${BOTSCAN_URL}/tx/${submittedTransaction}`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-zinc-300 underline underline-offset-4">View on BOTScan ↗</a><p className="mt-3 text-xs leading-6 text-zinc-500">{pending ? recoveryAvailable ? "Refreshing resumes the receipt check from public transaction details in this tab. No file is stored and no transaction is resubmitted." : "This browser cannot save recovery details. Keep this transaction link; refreshing will clear page progress. No file is stored and no transaction is resubmitted." : "Keep this transaction link to independently check the result on BOTScan."}</p></div>}
      {txOwner && (address?.toLowerCase() !== txOwner.toLowerCase() || chainId !== botChainMainnet.id) && <p className="mt-4 break-all text-xs leading-6 text-amber-300">Your wallet or network changed. This mainnet transaction belongs to {txOwner}; its confirmation is tracked independently.</p>}
      {error && <p role="alert" className="mt-5 text-sm leading-6 text-red-300">{error}</p>}
      {pending && phase === "idle" && <button type="button" onClick={() => { setPending({ ...pending, transaction: submittedTransaction ?? pending.transaction }); setConfirmationRetry((value) => value + 1); }} className="mt-4 text-sm text-zinc-200 underline underline-offset-4">Retry receipt check</button>}
    </div>
    <PrivacyNote />
  </div>;
}
