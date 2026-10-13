"use client";

import { useEffect, useRef, useState } from "react";
import { fingerprintFile, formatFileSize, type FileFingerprint } from "@/lib/proof";

type Props = {
  onChange: (fingerprint: FileFingerprint | null) => void;
  disabled?: boolean;
  onStatusChange?: (status: "idle" | "hashing" | "ready" | "error") => void;
};

export default function FilePicker({ onChange, disabled = false, onStatusChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);
  const [fingerprint, setFingerprint] = useState<FileFingerprint | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => { requestRef.current += 1; }, []);

  async function processFile(file?: File) {
    if (!file || disabled) return;
    const request = ++requestRef.current;
    setFingerprint(null);
    onChange(null);
    setError("");
    setBusy(true);
    onStatusChange?.("hashing");
    try {
      const result = await fingerprintFile(file);
      if (request !== requestRef.current) return;
      setFingerprint(result);
      onChange(result);
      onStatusChange?.("ready");
    } catch {
      if (request === requestRef.current) { setError("Could not read this file. Please choose another one."); onStatusChange?.("error"); }
    } finally {
      if (request === requestRef.current) setBusy(false);
    }
  }

  return (
    <div>
      <label
        htmlFor="file-input"
        onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void processFile(event.dataTransfer.files[0]);
        }}
        className={`block rounded-2xl border border-dashed p-8 text-center transition-colors sm:p-12 ${dragging ? "border-white bg-white/10" : "border-white/20 bg-white/[0.03] hover:border-white/40 hover:bg-white/[0.05]"} ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
      >
        <input
          ref={inputRef}
          id="file-input"
          type="file"
          className="sr-only"
          disabled={disabled}
          onChange={(event) => {
            void processFile(event.target.files?.[0]);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
        <span aria-hidden="true" className="mx-auto grid size-12 place-items-center rounded-xl border border-white/15 bg-white/5 text-2xl text-zinc-300">↑</span>
        <span className="mt-5 block text-base font-medium text-white">Drop a file here, or click to browse</span>
        <span className="mt-2 block text-sm text-zinc-500">Any file type · Processed locally in your browser</span>
      </label>

      <div aria-live="polite">
        {busy && <p className="mt-5 text-sm text-zinc-400">Calculating SHA-256 fingerprint… Large files may take longer and use more browser memory.</p>}
        {error && <p className="mt-5 text-sm text-red-300">{error}</p>}
        {fingerprint && (
          <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            <div className="grid gap-5 border-b border-white/10 p-5 sm:grid-cols-[1fr_auto] sm:p-6">
              <div className="min-w-0"><p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">File name</p><p className="mt-2 truncate text-sm font-medium text-white" title={fingerprint.name}>{fingerprint.name}</p></div>
              <div><p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">File size</p><p className="mt-2 text-sm text-white">{formatFileSize(fingerprint.size)}</p></div>
            </div>
            <div className="p-5 sm:p-6"><p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">SHA-256 Hash</p><p className="mt-3 break-all font-mono text-xs leading-6 text-zinc-300 sm:text-sm">{fingerprint.hash}</p></div>
          </div>
        )}
      </div>
      {(fingerprint || error) && !disabled && <button type="button" onClick={() => { requestRef.current += 1; setFingerprint(null); setError(""); setBusy(false); onChange(null); onStatusChange?.("idle"); }} className="mt-4 text-xs text-zinc-400 underline underline-offset-4 hover:text-white">Clear selected file</button>}
    </div>
  );
}
