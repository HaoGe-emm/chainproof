"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Address } from "viem";
import FilePicker from "@/components/file-picker";
import PrivacyNote from "@/components/privacy-note";
import { readProof } from "@/lib/chainproof";
import type { FileFingerprint } from "@/lib/proof";

type Lookup = { hash: string; owner: Address; timestamp: bigint; exists: boolean };
export default function VerifyPage() {
  const [fingerprint, setFingerprint] = useState<FileFingerprint | null>(null);
  const [fileStatus, setFileStatus] = useState("idle");
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setLookup(null); setError("");
    if (!fingerprint) { setChecking(false); return; }
    let active = true;
    setChecking(true);
    void readProof(fingerprint.hash).then(([owner, timestamp, exists]) => {
      if (active) setLookup({ hash: fingerprint.hash, owner, timestamp, exists });
    }).catch(() => { if (active) setError("The network could not confirm the registration status. Please retry."); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [fingerprint, retry]);
  const proof = lookup?.hash === fingerprint?.hash ? lookup : null;
  return <div className="w-full max-w-3xl self-center py-12 sm:py-20">
    <Link href="/" className="text-sm text-zinc-500 hover:text-white">← Back to home</Link>
    <div className="mt-9"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">02 / Check proof</p><h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Verify Provenance</h1><p className="mt-4 text-sm leading-7 text-zinc-400">Choose a file. Your browser computes its fingerprint, then checks for a matching registration on BOT Chain Mainnet. No wallet is needed.</p></div>
    <div className="mt-9"><FilePicker onChange={setFingerprint} onStatusChange={setFileStatus} /></div>
    <div aria-live="polite" className="mt-6">
      {!fingerprint && fileStatus === "idle" && <p className="text-sm text-zinc-400">No File Selected · Choose a file to begin.</p>}
      {fingerprint && checking && <p className="text-sm text-zinc-400">Checking BOT Chain Mainnet…</p>}
      {fingerprint && error && <div className="rounded-xl border border-red-400/25 bg-red-400/5 p-5 text-sm text-red-300"><h2 className="font-semibold">Verification Error</h2><p className="mt-2 leading-6">{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-4 rounded-lg border border-red-300/25 px-4 py-2 text-white">Retry</button></div>}
      {proof && <div className={`rounded-2xl border p-6 ${proof.exists ? "border-emerald-400/25 bg-emerald-400/10" : "border-amber-400/25 bg-amber-400/10"}`}>
        <h2 className={`text-base font-semibold ${proof.exists ? "text-emerald-300" : "text-amber-300"}`}>{proof.exists ? "Registered Fingerprint Found" : "No Matching Proof"}</h2>
        {proof.exists ? <><p className="mt-3 text-sm leading-6 text-zinc-300">These file bytes match a fingerprint registered on-chain. This does not establish originality, copyright ownership, or content truth.</p><dl className="mt-5 grid gap-4 border-t border-white/10 pt-5 text-sm sm:grid-cols-2"><div className="min-w-0"><dt className="text-zinc-400">Registered Wallet</dt><dd className="mt-1 break-all font-mono text-white">{proof.owner}</dd></div><div><dt className="text-zinc-400">Registration Time</dt><dd className="mt-1 text-white">{new Date(Number(proof.timestamp) * 1000).toLocaleString()}</dd></div><div className="min-w-0 sm:col-span-2"><dt className="text-zinc-400">File Fingerprint</dt><dd className="mt-1 break-all font-mono text-zinc-300">{proof.hash}</dd></div></dl><Link href={`/proof/0x${proof.hash}`} className="mt-5 inline-block text-sm font-medium text-emerald-300 underline underline-offset-4">View Certificate</Link></> : <p className="mt-3 text-sm leading-6 text-zinc-300">No registration for these file bytes was found. This result does not determine whether a file is modified, who authored it, or whether its content is authentic.</p>}
      </div>}
    </div>
    <PrivacyNote />
  </div>;
}
