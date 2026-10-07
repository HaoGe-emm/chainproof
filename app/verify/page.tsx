"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Address } from "viem";
import FilePicker from "@/components/file-picker";
import { readProof } from "@/lib/chainproof";
import type { FileFingerprint } from "@/lib/proof";
import { friendlyChainError } from "@/lib/wallet";

type Lookup = { hash: string; owner: Address; timestamp: bigint; exists: boolean };

export default function VerifyPage() {
  const [fingerprint, setFingerprint] = useState<FileFingerprint | null>(null);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!fingerprint) {
      setLookup(null);
      setError("");
      return;
    }
    let active = true;
    setLookup(null);
    setError("");
    setChecking(true);
    void readProof(fingerprint.hash).then(([owner, timestamp, exists]) => {
      if (active) setLookup({ hash: fingerprint.hash, owner, timestamp, exists });
    }).catch((cause) => {
      if (active) setError(friendlyChainError(cause, "Could not read proof from BOT Chain."));
    }).finally(() => {
      if (active) setChecking(false);
    });
    return () => { active = false; };
  }, [fingerprint]);

  const proof = lookup?.hash === fingerprint?.hash ? lookup : null;

  return (
    <div className="w-full max-w-3xl self-center py-12 sm:py-20">
      <Link href="/" className="text-sm text-zinc-500 transition-colors hover:text-white">← Back to home</Link>
      <div className="mt-11"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">02 / Check proof</p><h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Verify Provenance</h1><p className="mt-4 max-w-xl text-sm leading-7 text-zinc-400">Compare a file&apos;s fingerprint with the proof on BOT Chain Testnet.</p></div>
      <div className="mt-10"><FilePicker onChange={setFingerprint} /></div>
      <div aria-live="polite">
        {fingerprint && checking && <p className="mt-6 text-sm text-zinc-400">Checking BOT Chain Testnet…</p>}
        {fingerprint && error && <p className="mt-6 text-sm text-red-300">{error}</p>}
        {proof && <div className={`mt-7 rounded-2xl border p-6 ${proof.exists ? "border-emerald-400/25 bg-emerald-400/10" : "border-amber-400/25 bg-amber-400/10"}`}>
          <div className="flex items-center gap-3"><span className={`size-2 rounded-full ${proof.exists ? "bg-emerald-400" : "bg-amber-400"}`} /><h2 className={`text-sm font-bold tracking-[0.14em] ${proof.exists ? "text-emerald-300" : "text-amber-300"}`}>{proof.exists ? "PROVENANCE VERIFIED" : "NO MATCHING PROOF"}</h2></div>
          {proof.exists ? <dl className="mt-5 grid gap-4 border-t border-white/10 pt-5 text-sm sm:grid-cols-2"><div><dt className="text-zinc-500">Creator Wallet</dt><dd className="mt-1 break-all text-white">{proof.owner}</dd></div><div><dt className="text-zinc-500">Registration Time</dt><dd className="mt-1 text-white">{new Date(Number(proof.timestamp) * 1000).toLocaleString()}</dd></div><div className="sm:col-span-2"><dt className="text-zinc-500">File Fingerprint</dt><dd className="mt-1 break-all font-mono text-zinc-300">{proof.hash}</dd></div><div className="sm:col-span-2"><dt className="text-zinc-500">Network</dt><dd className="mt-1 text-white">BOT Chain Testnet</dd></div></dl> : <p className="mt-3 text-sm leading-6 text-zinc-400">No proof for this file was found on BOT Chain Testnet.</p>}
        </div>
        }
      </div>
      <p className="mt-7 text-xs leading-6 text-zinc-500">Verification reads the chain through the public RPC. No wallet connection is required.</p>
    </div>
  );
}
