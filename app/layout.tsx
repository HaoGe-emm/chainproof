import type { Metadata } from "next";
import Link from "next/link";
import { WalletProvider, WalletStatus } from "@/components/wallet-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChainProof",
  description: "Make digital work verifiable.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <WalletProvider>
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 sm:px-8">
          <header className="flex min-h-20 items-center justify-between gap-4 border-b border-white/10 py-3">
            <Link href="/" className="flex items-center gap-3 text-sm font-semibold tracking-[0.13em] text-white">
              <span className="grid size-8 place-items-center rounded-lg border border-white/20 bg-white/5 text-base">◇</span>
              CHAINPROOF
            </Link>
            <div className="flex items-center gap-6"><span className="hidden text-xs font-medium tracking-[0.18em] text-zinc-500 lg:block">BOT CHAIN MAINNET</span><WalletStatus /></div>
          </header>
          <main className="flex flex-1 flex-col">{children}</main>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 py-6 text-xs text-zinc-500">
            <span>ChainProof · BOT Chain Mainnet</span>
            <span>Files stay on your device.</span>
          </footer>
        </div>
        </WalletProvider>
      </body>
    </html>
  );
}
