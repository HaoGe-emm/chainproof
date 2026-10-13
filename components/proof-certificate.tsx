"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { BOTSCAN_URL, CHAIN_PROOF_ADDRESS, botChainMainnet, readProof } from "@/lib/chainproof";
import { certificateUrl, isLocalCertificateUrl, loadCertificate, normalizeCertificateHash, verifyFileCopy, type CertificateState, type CopyResult } from "@/lib/certificate";
import { fingerprintFile, formatFileSize } from "@/lib/proof";

const RESULT_TEXT: Record<CopyResult, string> = {
  match: "This file matches the on-chain registered fingerprint.",
  mismatch: "This file does not match the registered fingerprint.",
  error: "Unable to verify this file. Please try again.",
  unavailable: "Confirm the on-chain registration before verifying a file.",
};

export default function ProofCertificate({ hash: value }: { hash: string }) {
  const hash = normalizeCertificateHash(value);
  const [certificate, setCertificate] = useState<CertificateState>(hash ? { status: "loading", hash } : { status: "invalid" });
  const [retry, setRetry] = useState(0);
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");
  const [qrError, setQrError] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fileLabel, setFileLabel] = useState("");
  const [result, setResult] = useState<CopyResult | null>(null);
  const request = useRef(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    if (!hash) return;
    setCertificate({ status: "loading", hash });
    setResult(null);
    void loadCertificate(hash, readProof).then((next) => { if (active) setCertificate(next); });
    return () => { active = false; request.current += 1; };
  }, [hash, retry]);

  useEffect(() => {
    if (!hash) return;
    let active = true;
    const link = certificateUrl(window.location.origin, hash);
    setUrl(link);
    void QRCode.toDataURL(link, { width: 240, margin: 4, errorCorrectionLevel: "M" }).then((data) => {
      if (active) setQr(data);
    }).catch(() => { if (active) setQrError(true); });
    return () => { active = false; };
  }, [hash]);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(""), 2500);
    return () => clearTimeout(timer);
  }, [feedback]);

  async function copy(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text);
      setFeedback(message);
    } catch {
      setFeedback("Copy unavailable. Please select and copy the text manually.");
    }
  }

  async function processFile(file?: File) {
    if (!file || certificate.status !== "registered") return;
    const id = ++request.current;
    setBusy(true);
    setResult(null);
    setFileLabel(`${file.name} · ${formatFileSize(file.size)}`);
    const next = await verifyFileCopy(file, certificate, fingerprintFile);
    if (id !== request.current) return;
    setResult(next);
    setBusy(false);
  }

  const registered = certificate.status === "registered";
  const buttonStyle = "inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-white/30 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:opacity-40";
  const primaryStyle = "inline-flex min-h-12 items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:opacity-40";

  return (
    <div className="certificate-page w-full max-w-4xl self-center py-10 sm:py-16">
      <Link href="/" className="certificate-interactive text-sm text-zinc-500 hover:text-white">← Back to home</Link>
      <article className="certificate-sheet mt-7 min-w-0 overflow-hidden rounded-2xl border border-white/15 bg-white/[0.035] p-6 sm:p-10">
        <div className="certificate-heading border-b border-white/15 pb-7">
          <p className="text-sm font-semibold tracking-[0.25em] text-zinc-300">CHAINPROOF CERTIFICATE</p>
          <h1 className="mt-4 max-w-2xl text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Certificate of On-chain Registration</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">A public record of a file fingerprint on BOT Chain Mainnet.</p>
        </div>

        <div aria-live="polite" className="mt-7">
          {certificate.status === "loading" && <p className="text-sm text-zinc-400">Verifying registration on BOT Chain Mainnet…</p>}
          {certificate.status === "invalid" && <div className="text-amber-300"><h2 className="font-semibold">Invalid Fingerprint</h2><p className="mt-2 text-sm">The certificate URL must contain 0x followed by 64 hexadecimal characters.</p></div>}
          {certificate.status === "not-found" && <div className="text-amber-300"><h2 className="font-semibold">Proof Not Found</h2><p className="mt-2 text-sm">No registration was found for this fingerprint on BOT Chain Mainnet.</p></div>}
          {certificate.status === "error" && <div className="text-red-300"><h2 className="font-semibold">Verification Error</h2><p className="mt-2 text-sm">Could not read the on-chain record. Please retry.</p><button type="button" className={`${buttonStyle} certificate-interactive mt-4`} onClick={() => setRetry((count) => count + 1)}>Retry</button></div>}
          {registered && <><p className="certificate-status inline-flex rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-xs font-semibold tracking-[0.12em] text-emerald-300">REGISTERED ON BOT CHAIN MAINNET</p><p className="certificate-record-explanation mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Registered confirms this fingerprint is on-chain. It does not mean your file copy has been checked. Use Verify Your Copy on this public page to compare a file.</p></>}
        </div>

        {registered && <>
          <dl className="certificate-details mt-8 grid min-w-0 gap-6 text-sm sm:grid-cols-2">
            <div className="min-w-0 sm:col-span-2"><dt>File Fingerprint</dt><dd className="certificate-value mt-2 rounded-lg border border-white/10 bg-black/15 px-3 py-3 font-mono leading-6 text-white">{certificate.hash}</dd></div>
            <div className="min-w-0 sm:col-span-2"><dt className="flex flex-wrap items-center justify-between gap-2">Registered Wallet<button type="button" onClick={() => void copy(certificate.owner, "Wallet address copied.")} className="certificate-interactive rounded px-2 py-1 text-xs font-medium normal-case tracking-normal text-zinc-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white">Copy Wallet</button></dt><dd className="certificate-value mt-2 rounded-lg border border-white/10 bg-black/15 px-3 py-3 font-mono leading-6 text-white">{certificate.owner}</dd></div>
            <div><dt>Registration Timestamp</dt><dd className="mt-2 text-white">{new Date(Number(certificate.timestamp) * 1000).toISOString().replace("T", " ").replace(".000Z", " UTC")}<span className="mt-1 block text-xs text-zinc-500">Unix: {certificate.timestamp.toString()}</span></dd></div>
            <div><dt>On-chain Status</dt><dd className="mt-2 text-white">Registered</dd></div>
            <div><dt>Network</dt><dd className="mt-2 text-white">{botChainMainnet.name}</dd></div>
            <div><dt>Chain ID</dt><dd className="mt-2 text-white">{botChainMainnet.id}</dd></div>
            <div className="min-w-0 sm:col-span-2"><dt>Contract Address</dt><dd className="certificate-value mt-2 font-mono leading-6 text-white">{CHAIN_PROOF_ADDRESS}</dd></div>
            <div><dt>Verification Method</dt><dd className="mt-2 text-white">SHA-256</dd></div>
          </dl>

          <div className="certificate-share mt-8 flex min-w-0 flex-col gap-5 border-t border-white/15 pt-7 sm:flex-row sm:items-center">
            {qr ? <img src={qr} width={160} height={160} alt="QR code for this public certificate" className="certificate-qr size-40 shrink-0 rounded-lg bg-white" /> : <p className="text-sm text-zinc-400">{qrError ? "QR code unavailable. Use the certificate link." : "Preparing QR code…"}</p>}
            <div className="min-w-0 flex-1"><p className="text-xs font-medium uppercase tracking-[0.15em] text-zinc-400">Public Certificate Link</p>{url ? <a href={url} className="certificate-public-link certificate-value mt-3 block rounded-lg border border-white/15 bg-black/15 px-3 py-3 text-sm leading-6 text-zinc-100 underline decoration-zinc-600 underline-offset-4 hover:decoration-zinc-300 focus-visible:outline-2 focus-visible:outline-white">{url}</a> : <p className="mt-3 text-sm text-zinc-400">Preparing link…</p>}<p className="mt-3 text-sm leading-6 text-zinc-400">Scan or open this link to query the registration. No wallet or Gas is required.</p>{isLocalCertificateUrl(url) && <p className="certificate-local-notice mt-3 text-sm leading-6 text-amber-200/85">Local preview link: other devices cannot open this address directly. Open the deployed site to share a public certificate.</p>}</div>
          </div>

          <div className="certificate-interactive mt-7 space-y-4">
            <div role="group" aria-label="Primary certificate actions" className="grid gap-3 sm:flex sm:flex-wrap">
              <button type="button" className={`${primaryStyle} bg-white text-zinc-950 hover:bg-zinc-200`} disabled={!url} onClick={() => void copy(url, "Certificate link copied.")}>Copy Certificate Link</button>
              <a className={`${primaryStyle} border border-white/25 bg-white/10 text-white hover:bg-white/15`} href="#verify-your-copy">Verify Your Copy</a>
            </div>
            <div role="group" aria-label="Secondary certificate actions" className="grid gap-3 sm:flex sm:flex-wrap">
              <button type="button" className={buttonStyle} onClick={() => void copy(certificate.hash, "Fingerprint copied.")}>Copy Fingerprint</button>
              <a className={buttonStyle} href={`${BOTSCAN_URL}/address/${CHAIN_PROOF_ADDRESS}`} target="_blank" rel="noopener noreferrer">View Contract on BOTScan ↗</a>
              <button type="button" className={buttonStyle} disabled={!url || (!qr && !qrError)} onClick={() => window.print()}>Print / Save as PDF</button>
            </div>
          </div>
          <p role="status" className="certificate-interactive mt-3 min-h-5 text-sm text-zinc-300">{feedback}</p>
        </>}

        <div className="certificate-notice mt-7 border-t border-white/15 pt-6 text-sm leading-7 text-zinc-400">
          <p>This record identifies a registered wallet and file fingerprint at a blockchain timestamp. It cannot recover the original file or filename, establish a real-world identity, or prove originality, copyright ownership, or content truth. Title and Proof Type are not certified on-chain.</p>
          <p className="mt-2">To confirm a file matches this record, use Verify Your Copy. A printed or PDF certificate is a display copy of chain data, not a legal certificate issued by an accredited authority. Independently verify the record using the public page or the contract.</p>
          <p className="mt-2">Fingerprints are public. Known or guessable file content may be identified by comparing hashes, even though the original file is never uploaded.</p>
        </div>
      </article>

      <section id="verify-your-copy" className="certificate-interactive mt-8 rounded-2xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
        <h2 className="text-xl font-semibold tracking-tight">Verify Your Copy</h2>
        <p className="mt-3 text-sm leading-7 text-zinc-400">Compare your file&apos;s bytes with the registered fingerprint. The file stays in your browser; its name is not used for matching.</p>
        {!registered ? <p className="mt-5 text-sm text-zinc-500">File verification becomes available after the on-chain registration is confirmed.</p> : <>
          {!result && !busy && <div className="mt-5 rounded-xl border border-white/15 bg-white/[0.03] p-4"><p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">File Copy Status</p><p className="mt-2 text-sm font-semibold text-zinc-200">NOT CHECKED</p><p className="mt-2 text-sm leading-6 text-zinc-400">Choose a file to check whether its bytes match the registered fingerprint.</p></div>}
          <label htmlFor="certificate-file" onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void processFile(event.dataTransfer.files[0]); }} className={`mt-6 block cursor-pointer rounded-xl border border-dashed p-7 text-center ${dragging ? "border-white bg-white/10" : "border-white/20 bg-white/[0.03]"}`}>
            <input id="certificate-file" ref={input} type="file" className="sr-only" onChange={(event) => { void processFile(event.target.files?.[0]); if (input.current) input.current.value = ""; }} />
            <span className="block text-sm font-medium">Drop a file here, or click to browse</span><span className="mt-2 block text-xs text-zinc-500">Any file type · Local SHA-256 verification</span>
          </label>
          <div aria-live="polite" className="mt-5">
            {fileLabel && <p className="break-all text-xs text-zinc-400">{fileLabel}</p>}
            {busy && <p className="mt-3 text-sm text-zinc-300">Reading file and calculating SHA-256… Large files may take longer and use more browser memory.</p>}
            {result && <div className={`mt-4 rounded-xl border p-4 text-sm ${result === "match" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : result === "mismatch" ? "border-amber-400/25 bg-amber-400/10 text-amber-300" : "border-red-400/25 bg-red-400/10 text-red-300"}`}><p className="text-xs font-medium uppercase tracking-[0.12em]">File Copy Status</p><p className="mt-2 font-semibold">{result.toUpperCase()}</p><p className="mt-2 leading-6">{RESULT_TEXT[result]}</p></div>}
          </div>
        </>}
      </section>
    </div>
  );
}
