"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletStatus } from "@/components/wallet-provider";

const links = [["/", "Home"], ["/register", "Create Proof"], ["/verify", "Verify"], ["/my-proofs", "My Proofs"]] as const;
export default function SiteHeader() {
  const pathname = usePathname();
  return <header className="grid min-w-0 grid-cols-[1fr_auto] items-start gap-4 border-b border-white/10 py-4 lg:grid-cols-[auto_1fr_auto] lg:items-center">
    <Link href="/" aria-label="ChainProof home" className="flex items-center gap-2 pt-1 text-xs font-semibold tracking-[0.12em] text-white sm:gap-3 sm:text-sm"><span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/20 bg-white/5 text-base">◇</span>CHAINPROOF</Link>
    <nav aria-label="Main navigation" className="order-3 col-span-2 flex flex-wrap gap-1 lg:order-2 lg:col-span-1 lg:justify-center">{links.map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-white sm:text-sm ${pathname === href ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}>{label}</Link>)}</nav>
    <div className="order-2 min-w-0 lg:order-3">{process.env.NODE_ENV === "development" && pathname.startsWith("/metamask-local")?<span className="text-xs text-amber-200">Local test wallet below · 31338</span>:<WalletStatus />}</div>
  </header>;
}
export function SiteNetworkLabel(){const path=usePathname();return <span>{process.env.NODE_ENV === "development" && path.startsWith("/metamask-local")?"ChainProof · MetaMask Local Test 31338":"ChainProof · BOT Chain Mainnet"}</span>;}
