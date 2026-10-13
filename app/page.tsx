import Link from "next/link";
import PrivacyNote from "@/components/privacy-note";

const exampleHash = "0x8ed3e3e1dc015bd4fe18a80b93adccbd93ea9f7ee7a577600ae6d2e07642f625";
const exampleTx = "0x60e363ce4a5c67b86640f9b8d13122a77b2387a12d736518d34070bac454aafc";
const actions = [
  { href: "/register", number: "01", title: "Create Proof", text: "Register a file fingerprint on BOT Chain." },
  { href: "/verify", number: "02", title: "Verify Provenance", text: "Check whether a file matches a registered fingerprint." },
  { href: "/my-proofs", number: "03", title: "My Proofs", text: "Explore your wallet's on-chain registration history." },
  { href: `/proof/${exampleHash}`, number: "04", title: "Proof Certificate", text: "View and share a public registration certificate.", note: "Open a real mainnet example" },
];
export default function Home() {
  return <div className="py-14 sm:py-20">
    <div className="max-w-3xl">
      <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-zinc-300"><span className="size-1.5 rounded-full bg-emerald-400" />Files stay local · BOT Chain Mainnet</p>
      <h1 className="mt-7 text-5xl font-semibold tracking-[-0.065em] sm:text-7xl lg:text-8xl">ChainProof<span className="text-zinc-500">.</span></h1>
      <p className="mt-6 text-xl text-zinc-200 sm:text-2xl">Make digital work verifiable.</p>
      <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400">Register a file fingerprint on BOT Chain. Share the record. Verify any copy independently.</p>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-500">Digital work is easy to copy and change. ChainProof helps you check whether a file matches a previously registered version.</p>
    </div>
    <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{actions.map((action, index) => <Link key={action.href} href={action.href} className={`rounded-2xl border p-5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ${index === 0 ? "border-white bg-white text-zinc-950 hover:bg-zinc-200" : "border-white/15 bg-white/[0.035] text-white hover:bg-white/[0.07]"}`}>
      <p className={`text-xs font-semibold tracking-[0.14em] ${index === 0 ? "text-zinc-600" : "text-zinc-400"}`}>{action.number} / {action.title}</p><h2 className="mt-7 text-xl font-semibold tracking-tight">{action.title}<span aria-hidden="true" className="ml-2 text-base">↗</span></h2><p className={`mt-3 text-sm leading-6 ${index === 0 ? "text-zinc-600" : "text-zinc-400"}`}>{action.text}</p>{action.note && <p className="mt-3 text-xs text-emerald-300">{action.note}</p>}
    </Link>)}</div>
    <section className="mt-14 border-t border-white/10 pt-9"><h2 className="text-xl font-semibold tracking-tight">How It Works</h2><ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{["Select a File", "Hash Locally", "Register on BOT Chain", "Share & Verify"].map((step, index) => <li key={step} className="rounded-xl border border-white/10 p-4"><span className="text-xs text-zinc-500">0{index + 1}</span><p className="mt-2 text-sm font-medium">{step}</p></li>)}</ol><p className="mt-5 text-sm leading-7 text-zinc-400">Your browser computes a SHA-256 fingerprint from the file&apos;s bytes. The original file stays on your device; only its fingerprint is registered on-chain.</p></section>
    <section className="mt-10 grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6"><h2 className="text-xl font-semibold">Why On-chain?</h2><ul className="mt-5 space-y-3 text-sm leading-6 text-zinc-300"><li>Independent verification through the public contract.</li><li>Publicly auditable, timestamped registration records.</li><li>No need to trust ChainProof&apos;s own database.</li></ul><p className="mt-5 text-xs leading-6 text-zinc-400">Registration identifies a wallet and a file version. It does not certify originality, copyright, real-world identity, or content truth.</p><PrivacyNote /></div>
      <div className="min-w-0 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.035] p-6"><p className="text-xs font-medium uppercase tracking-[0.14em] text-emerald-300">Real mainnet registration</p><h2 className="mt-3 text-xl font-semibold">Live Mainnet Example</h2><p className="mt-3 text-sm leading-7 text-zinc-400">Explore an existing BOT Chain record. No new transaction, wallet connection, or network fee is needed to view its certificate.</p><p className="mt-4 text-xs text-zinc-500">Registered fingerprint</p><p className="mt-2 break-all font-mono text-xs leading-6 text-zinc-300">{exampleHash}</p><div className="mt-6 flex flex-wrap gap-4 text-sm"><Link href={`/proof/${exampleHash}`} className="font-medium text-white underline underline-offset-4">View Certificate</Link><a href={`https://scan.botchain.ai/tx/${exampleTx}`} target="_blank" rel="noopener noreferrer" className="text-zinc-300 underline underline-offset-4">View Transaction on BOTScan ↗</a></div></div>
    </section>
  </div>;
}
