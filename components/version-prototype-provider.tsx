"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { decodeDemoWorks, encodeDemoWorks, VERSION_DEMO_KEY, type DemoWork } from "@/lib/version-history";

const Context = createContext<{
  works: DemoWork[]; ready: boolean; save: (work: DemoWork) => void;
} | null>(null);

export function useVersionPrototype() {
  const value = useContext(Context);
  if (!value) throw new Error("Version prototype provider is missing.");
  return value;
}

export default function VersionPrototypeProvider({ children }: { children: ReactNode }) {
  const [works, setWorks] = useState<DemoWork[]>([]);
  const [ready, setReady] = useState(false);
  const [warning, setWarning] = useState("");
  const [corrupt, setCorrupt] = useState(false);
  const current = useRef<DemoWork[]>([]);
  const persistent = useRef(true);
  useEffect(() => {
    let raw: string | null;
    try { raw = localStorage.getItem(VERSION_DEMO_KEY); }
    catch { persistent.current = false; setWarning("Browser storage is unavailable. This demo will remain in memory and disappear when you leave or refresh."); setReady(true); return; }
    try { const saved = decodeDemoWorks(raw); current.current = saved; setWorks(saved); setReady(true); }
    catch { persistent.current = false; setCorrupt(true); setWarning("Saved prototype data could not be validated. It has not been overwritten. You can continue with a separate in-memory demo."); }
  }, []);

  function save(work: DemoWork) {
    const found = current.current.some((item) => item.workId === work.workId);
    if (!found && current.current.length >= 20) throw new Error("This prototype supports at most 20 local works.");
    const next = found ? current.current.map((item) => item.workId === work.workId ? work : item) : [...current.current, work];
    const safe = decodeDemoWorks(encodeDemoWorks(next));
    if (persistent.current) {
      try { localStorage.setItem(VERSION_DEMO_KEY, encodeDemoWorks(safe)); }
      catch { persistent.current = false; setWarning("Browser storage is unavailable. Changes are in memory only; refreshing will lose them."); }
    }
    current.current = safe; setWorks(safe);
  }

  return <Context.Provider value={{ works, ready, save }}>
    <div className="w-full min-w-0 max-w-4xl self-center py-10 sm:py-16">
      <aside className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-5 text-sm leading-6">
        <p className="font-semibold text-amber-300">Prototype / Demo · Version History</p>
        <p className="mt-2 text-zinc-300">Work relationships and proof fixtures below are local examples, not BOT Chain records. No transaction or signature is requested.</p>
        <p className="mt-2 text-xs text-zinc-400">Local data can be edited or lost. A work URL cannot share this history across devices or site origins. Simulated wallets do not prove wallet control.</p>
      </aside>
      <nav aria-label="Prototype navigation" className="my-6 flex flex-wrap gap-5 text-sm text-zinc-300">
        <Link href="/works" className="underline underline-offset-4">Demo works</Link>
        <Link href="/works/new" className="underline underline-offset-4">Create demo work</Link>
        <Link href="/" className="underline underline-offset-4">Back to production home</Link>
      </nav>
      {warning && <div role="alert" className="mb-6 rounded-xl border border-amber-400/20 p-4 text-sm leading-6 text-amber-200"><p>{warning}</p>{corrupt && <button type="button" onClick={() => { setCorrupt(false); setReady(true); }} className="mt-3 underline underline-offset-4">Continue in memory</button>}</div>}
      {!ready ? <p role="status" className="text-sm text-zinc-400">{corrupt ? "Saved demo unavailable." : "Loading local prototype…"}</p> : children}
    </div>
  </Context.Provider>;
}
