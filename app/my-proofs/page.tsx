"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAbiItem, type Address } from "viem";
import { useWallet } from "@/components/wallet-provider";
import { BOTSCAN_URL, CHAIN_PROOF_ADDRESS, botChainMainnet, chainProofAbi, publicClient } from "@/lib/chainproof";
import {
  historyDisplayState,
  newestProofsFirst,
  scanProofHistory,
  PROOF_CONFIRMATIONS,
  PROOF_DEPLOYMENT_BLOCK,
  type HistoryStatus,
  type ProofRecord,
} from "@/lib/proof-history";

const proofEvent = getAbiItem({ abi: chainProofAbi, name: "ProofRegistered" });
const PAGE_SIZE = 10;

function History({ account }: { account: Address }) {
  const [records, setRecords] = useState<ProofRecord[]>([]);
  const [status, setStatus] = useState<HistoryStatus>("loading");
  const [error, setError] = useState("");
  const [confirmedHead, setConfirmedHead] = useState<bigint | null>(null);
  const [scannedTo, setScannedTo] = useState<bigint | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [copied, setCopied] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (status !== "loading") return;
    setElapsed(0);
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [status, refresh]);

  useEffect(() => {
    let cancelled = false;
    setRecords([]);
    setStatus("loading");
    setError("");
    setScannedTo(null);
    setConfirmedHead(null);
    setVisibleCount(PAGE_SIZE);

    async function scan() {
      try {
        await scanProofHistory({
          owner: account, contract: CHAIN_PROOF_ADDRESS, event: proofEvent, chainId: botChainMainnet.id,
          source: {
            getChainId: () => publicClient.getChainId(),
            getBlockNumber: () => publicClient.getBlockNumber(),
            getLogs: (owner, fromBlock, toBlock) => publicClient.getLogs({
              address: CHAIN_PROOF_ADDRESS,
              event: proofEvent,
              args: { owner },
              fromBlock,
              toBlock,
              strict: true,
            }),
          },
          shouldStop: () => cancelled,
          onHead: setConfirmedHead,
          onRange: (found, fromBlock) => {
            if (found.length) setRecords((current) => newestProofsFirst([...current, ...found]));
            setScannedTo(fromBlock);
          },
          onComplete: () => setStatus("complete"),
        });
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error && cause.message.includes("wrong network")
          ? "The BOT Chain RPC returned the wrong network."
          : "Could not finish reading chain history. Partial results may be shown. Please retry.");
        setStatus("error");
      }
    }

    void scan();
    return () => { cancelled = true; };
  }, [account, refresh]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(""), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copyHash(record: ProofRecord) {
    try {
      await navigator.clipboard.writeText(record.fileHash.slice(2));
      setCopied(record.transactionHash);
    } catch {
      setError("Could not copy the hash. Please copy it manually.");
    }
  }

  const displayState = historyDisplayState(account, status, records.length);
  const shown = records.slice(0, visibleCount);

  return (
    <>
      <p className="mt-3 break-all font-mono text-sm text-zinc-300">{account}</p>
      <div aria-live="polite" className="mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-semibold text-zinc-200">{status === "error" ? "Scan Failed" : status === "complete" ? "Scan Complete" : records.length ? "Partial Results · Scanning" : "Scanning"}</h2>{status === "complete" && <button type="button" onClick={() => setRefresh((value) => value + 1)} className="text-xs text-zinc-400 underline underline-offset-4">Refresh history</button>}</div>
        {status === "loading" && <p className="text-sm leading-6 text-zinc-400">
          Scanning confirmed BOT Chain blocks… {scannedTo !== null && confirmedHead !== null &&
            `Checked ${confirmedHead.toLocaleString()} down to ${scannedTo.toLocaleString()} of ${PROOF_DEPLOYMENT_BLOCK.toLocaleString()}.`}
          {records.length > 0 && " Results below are partial until scanning finishes."}
        </p>}
        {status === "loading" && confirmedHead !== null && <div className="mt-3"><progress aria-label="History scan progress" className="h-1.5 w-full accent-emerald-400" max={100} value={scannedTo === null ? 0 : Math.min(100, Number(confirmedHead - scannedTo + BigInt(1)) / Math.max(1, Number(confirmedHead - PROOF_DEPLOYMENT_BLOCK + BigInt(1))) * 100)} /><p className="mt-2 text-xs text-zinc-500">{elapsed}s elapsed{elapsed > 15 ? " · Reading history in small ranges; RPC retries can take time." : ""}</p></div>}
        {status === "complete" && <p className="text-sm leading-6 text-zinc-400">
          Scan complete through block {confirmedHead?.toLocaleString()}. The newest {PROOF_CONFIRMATIONS.toString()} blocks await confirmation.
        </p>}
        {displayState === "empty" && <p className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] p-6 text-sm text-zinc-300">
          No proofs found for this wallet in the confirmed history of this contract.
        </p>}
        {error && <div className="mt-5 flex flex-wrap items-center gap-4 rounded-xl border border-red-400/20 bg-red-400/5 p-5 text-sm text-red-300">
          <p>{error}</p>
          {status === "error" && <button type="button" onClick={() => setRefresh((value) => value + 1)} className="rounded-lg border border-red-300/30 px-3 py-2 font-medium text-white transition-colors hover:bg-white/10">Retry</button>}
        </div>}
      </div>

      {records.length > 0 && <div className="mt-8 space-y-4">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">{records.length} {records.length === 1 ? "PROOF" : "PROOFS"} FOUND{status !== "complete" && " SO FAR"}</p>
        {shown.map((record) => <article key={`${record.transactionHash}-${record.logIndex}`} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
          <dl className="grid min-w-0 gap-5 text-sm sm:grid-cols-2">
            <div className="min-w-0 sm:col-span-2"><dt className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">File Fingerprint</dt><dd className="mt-2 break-all font-mono leading-6 text-white">{record.fileHash.slice(2)}</dd></div>
            <div className="min-w-0"><dt className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Registered Wallet</dt><dd className="mt-2 break-all font-mono leading-6 text-zinc-300">{record.owner}</dd></div>
            <div className="min-w-0"><dt className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Registration Time</dt><dd className="mt-2 text-zinc-300">{new Date(Number(record.timestamp) * 1000).toLocaleString()}</dd></div>
            <div className="min-w-0 sm:col-span-2"><dt className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Transaction Hash</dt><dd className="mt-2 break-all font-mono leading-6 text-zinc-300">{record.transactionHash}</dd></div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-4 border-t border-white/10 pt-5 text-sm">
            <button type="button" onClick={() => void copyHash(record)} className="font-medium text-white underline underline-offset-4 hover:text-zinc-300">{copied === record.transactionHash ? "Copied" : "Copy Hash"}</button>
            <a href={`${BOTSCAN_URL}/tx/${record.transactionHash}`} target="_blank" rel="noopener noreferrer" className="font-medium text-zinc-300 underline underline-offset-4 hover:text-white">View on BOTScan ↗</a>
            <Link href={`/proof/${record.fileHash}`} className="font-medium text-zinc-300 underline underline-offset-4 hover:text-white">View Certificate</Link>
          </div>
        </article>)}
        {records.length > visibleCount && <button type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)} className="rounded-xl border border-white/20 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10">Show more</button>}
      </div>}
    </>
  );
}

export default function MyProofsPage() {
  const { address, chainId, connecting, metaMaskAvailable, error, connect } = useWallet();
  const ready = Boolean(address && chainId === botChainMainnet.id);

  return (
    <div className="w-full max-w-3xl self-center py-12 sm:py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">03 / Your on-chain history</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">My Proofs</h1>
      <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-400">Proofs registered by your wallet on BOT Chain Mainnet. File names and contents are not stored on chain.</p>

      {!address && <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-sm text-zinc-300">Connect Wallet to view your proofs.</p>
        <button type="button" disabled={connecting || metaMaskAvailable === false} onClick={() => void connect().catch(() => {})} className="mt-5 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40">{connecting ? "Connecting…" : "Connect Wallet"}</button>
        {(error || metaMaskAvailable === false) && <p className="mt-4 text-sm text-red-300">{metaMaskAvailable === false ? "MetaMask is required." : error}</p>}
      </div>}
      {address && !ready && <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-sm text-zinc-300">Switch MetaMask to BOT Chain Mainnet to view your proofs.</p>
        <button type="button" disabled={connecting} onClick={() => void connect().catch(() => {})} className="mt-5 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-40">Switch network</button>
        {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
      </div>}
      {ready && address && <History key={`${chainId}:${address.toLowerCase()}`} account={address} />}
    </div>
  );
}
