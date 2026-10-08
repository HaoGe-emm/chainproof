"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createWalletClient, custom, type Address, type Hex } from "viem";
import FilePicker from "@/components/file-picker";
import { useWallet } from "@/components/wallet-provider";
import { BOTSCAN_URL, CHAIN_PROOF_ADDRESS, botChainMainnet, chainProofAbi, publicClient, readProof, receiptRegistersProof, toFileHashBytes32 } from "@/lib/chainproof";
import { PROOF_TYPES, type FileFingerprint, type ProofType } from "@/lib/proof";
import { friendlyChainError } from "@/lib/wallet";

type CreatedProof = { creator: Address; hash: string; transaction: Hex };
type ExistingProof = { hash: string; owner: Address; timestamp: bigint };
type Phase = "idle" | "wallet" | "checking" | "confirming" | "receipt";

export default function RegisterPage() {
  const [fingerprint, setFingerprint] = useState<FileFingerprint | null>(null);
  const [title, setTitle] = useState("");
  const [proofType, setProofType] = useState<ProofType>("AI Content");
  const [phase, setPhase] = useState<Phase>("idle");
  const [created, setCreated] = useState<CreatedProof | null>(null);
  const [existingProof, setExistingProof] = useState<ExistingProof | null>(null);
  const [checkedHash, setCheckedHash] = useState<string | null>(null);
  const [submittedTransaction, setSubmittedTransaction] = useState<Hex | null>(null);
  const [error, setError] = useState("");
  const { connect } = useWallet();
  const loading = phase !== "idle";
  const checkingFile = Boolean(fingerprint && checkedHash !== fingerprint.hash);
  const currentProof = existingProof?.hash === fingerprint?.hash ? existingProof : null;

  useEffect(() => {
    if (!fingerprint) return;
    const hash = fingerprint.hash;
    let active = true;
    void readProof(hash).then(([owner, timestamp, exists]) => {
      if (active && exists) setExistingProof({ hash, owner, timestamp });
    }).catch(() => {
      // The submit flow checks again and displays any RPC error.
    }).finally(() => {
      if (active) setCheckedHash(hash);
    });
    return () => { active = false; };
  }, [fingerprint]);

  function handleFileChange(next: FileFingerprint | null) {
    setFingerprint(next);
    setCreated(null);
    setExistingProof(null);
    setCheckedHash(null);
    setSubmittedTransaction(null);
    setError("");
  }

  async function register() {
    if (!fingerprint || !title.trim() || loading || checkingFile || currentProof) return;
    setPhase("wallet");
    setError("");
    setSubmittedTransaction(null);
    let submitted = false;
    try {
      const { account, provider } = await connect();
      setPhase("checking");
      const [owner, timestamp, exists] = await readProof(fingerprint.hash);
      if (exists) {
        setExistingProof({ hash: fingerprint.hash, owner, timestamp });
        return;
      }

      setPhase("confirming");
      const fileHash = toFileHashBytes32(fingerprint.hash);
      const walletClient = createWalletClient({ account, chain: botChainMainnet, transport: custom(provider) });
      const transaction = await walletClient.writeContract({
        address: CHAIN_PROOF_ADDRESS,
        abi: chainProofAbi,
        functionName: "registerProof",
        args: [fileHash],
      });

      submitted = true;
      setSubmittedTransaction(transaction);
      setPhase("receipt");
      let cancelled = false;
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: transaction,
        timeout: 120_000,
        onReplaced: ({ reason, transactionReceipt }) => {
          cancelled = reason === "cancelled";
          setSubmittedTransaction(transactionReceipt.transactionHash);
        },
      });
      if (cancelled) {
        setError("Transaction was cancelled.");
        return;
      }
      if (receipt.status !== "success") {
        const [, , nowExists] = await readProof(fingerprint.hash);
        setError(nowExists ? "This file already has a provenance proof." : "Transaction failed on BOT Chain.");
        return;
      }
      if (!receiptRegistersProof(receipt, fileHash, account)) {
        setError("This transaction did not create the requested proof.");
        return;
      }
      setCreated({ creator: account, hash: fingerprint.hash, transaction: receipt.transactionHash });
    } catch (cause) {
      setError(submitted ? "Transaction submitted, but confirmation is unavailable. Check BOTScan before retrying." : friendlyChainError(cause));
    } finally {
      setPhase("idle");
    }
  }

  return (
    <div className="w-full max-w-3xl self-center py-12 sm:py-20">
      <Link href="/" className="text-sm text-zinc-500 transition-colors hover:text-white">← Back to home</Link>
      <div className="mt-11"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">01 / Create proof</p><h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Create Proof</h1><p className="mt-4 max-w-xl text-sm leading-7 text-zinc-400">Describe your work, then choose a file. Its SHA-256 fingerprint is calculated on your device.</p></div>
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium text-zinc-300">
          Title
          <input type="text" value={title} maxLength={120} placeholder="e.g. Final research report" disabled={loading} onChange={(event) => setTitle(event.target.value)} className="mt-2 block w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-white/50 disabled:opacity-60" />
        </label>
        <label className="block text-sm font-medium text-zinc-300">
          Proof Type
          <select value={proofType} disabled={loading} onChange={(event) => setProofType(event.target.value as ProofType)} className="mt-2 block w-full rounded-xl border border-white/15 bg-[#14161b] px-4 py-3 text-sm text-white outline-none focus:border-white/50 disabled:opacity-60">
            {PROOF_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-6"><FilePicker onChange={handleFileChange} disabled={loading} /></div>
      <div className="mt-7 flex flex-wrap items-center gap-4">
        <button type="button" disabled={!fingerprint || !title.trim() || loading || checkingFile || Boolean(currentProof) || Boolean(created)} onClick={() => void register()} className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40">{phase === "wallet" ? "Connecting wallet…" : phase === "checking" || checkingFile ? "Checking proof…" : phase === "confirming" ? "Confirm in MetaMask…" : phase === "receipt" ? "Waiting for confirmation…" : "Create Proof"}</button>
        <span className="text-xs text-zinc-500">Only the file fingerprint is sent on chain.</span>
      </div>
      <div aria-live="polite">
        {currentProof && <div className="mt-6 rounded-xl border border-amber-400/25 bg-amber-400/10 p-5 text-sm"><p className="font-medium text-amber-300">A provenance proof for this file already exists on BOT Chain.</p><dl className="mt-4 grid gap-4 border-t border-white/10 pt-4 text-zinc-300 sm:grid-cols-2"><div><dt className="text-xs text-zinc-500">Creator Wallet</dt><dd className="mt-1 break-all font-mono">{currentProof.owner}</dd></div><div><dt className="text-xs text-zinc-500">Registration Time</dt><dd className="mt-1">{new Date(Number(currentProof.timestamp) * 1000).toLocaleString()}</dd></div></dl></div>}
        {created && <div className="mt-6 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-5 text-sm text-emerald-300"><h2 className="font-semibold">✓ Provenance Proof Created</h2><dl className="mt-4 space-y-3 text-zinc-300"><div><dt className="text-xs text-zinc-500">Creator</dt><dd className="mt-1 break-all font-mono">{created.creator}</dd></div><div><dt className="text-xs text-zinc-500">File Hash</dt><dd className="mt-1 break-all font-mono">{created.hash}</dd></div><div><dt className="text-xs text-zinc-500">Transaction</dt><dd className="mt-1 break-all font-mono">{created.transaction}</dd></div></dl><a href={`${BOTSCAN_URL}/tx/${created.transaction}`} target="_blank" rel="noopener noreferrer" className="mt-5 inline-block font-medium underline underline-offset-4 hover:text-white">View on BOTScan ↗</a></div>}
        {error && <p className="mt-5 text-sm text-red-300">{error}</p>}
        {submittedTransaction && !created && <a href={`${BOTSCAN_URL}/tx/${submittedTransaction}`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm text-zinc-300 underline underline-offset-4 hover:text-white">View submitted transaction on BOTScan ↗</a>}
      </div>
      <p className="mt-6 text-xs text-zinc-500">Title and Proof Type are for this screen; the contract records only the file hash, wallet, and time.</p>
    </div>
  );
}
