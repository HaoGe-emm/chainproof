import Link from "next/link";

function Arrow() {
  return <span aria-hidden="true" className="text-lg leading-none">↗</span>;
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col justify-center py-20 sm:py-28">
      <div className="max-w-3xl">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          Private by design · Bohr Testnet
        </div>
        <h1 className="text-6xl font-semibold tracking-[-0.065em] text-white sm:text-7xl lg:text-8xl">ChainProof<span className="text-zinc-500">.</span></h1>
        <p className="mt-7 max-w-xl text-xl leading-relaxed text-zinc-300 sm:text-2xl">Make digital work verifiable.</p>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-zinc-500">Create tamper-evident provenance records for AI content, research, creative work and hackathon submissions on BOT Chain.</p>
      </div>

      <div className="mt-14 grid max-w-3xl gap-4 sm:grid-cols-2">
        <Link href="/register" className="group rounded-2xl border border-white/20 bg-white p-6 text-zinc-950 transition-colors hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          <div className="flex items-start justify-between"><span className="text-xs font-semibold tracking-[0.16em] text-zinc-500">01 / CREATE</span><Arrow /></div>
          <h2 className="mt-12 text-2xl font-semibold tracking-tight">Create Proof</h2>
          <p className="mt-2 text-sm text-zinc-600">Create a provenance record for your work.</p>
        </Link>
        <Link href="/verify" className="group rounded-2xl border border-white/15 bg-white/[0.04] p-6 text-white transition-colors hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          <div className="flex items-start justify-between"><span className="text-xs font-semibold tracking-[0.16em] text-zinc-500">02 / CHECK</span><Arrow /></div>
          <h2 className="mt-12 text-2xl font-semibold tracking-tight">Verify Provenance</h2>
          <p className="mt-2 text-sm text-zinc-400">Check a file against its on-chain provenance record.</p>
        </Link>
      </div>
    </div>
  );
}
