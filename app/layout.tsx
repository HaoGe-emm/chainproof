import type { Metadata } from "next";
import { WalletProvider } from "@/components/wallet-provider";
import SiteHeader,{ SiteNetworkLabel } from "@/components/site-header";
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
        <div className="app-shell mx-auto flex min-h-screen max-w-6xl flex-col px-5 sm:px-8">
          <SiteHeader />
          <main className="flex flex-1 flex-col">{children}</main>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 py-6 text-xs text-zinc-500">
            <SiteNetworkLabel />
            <span>Files stay on your device.</span>
          </footer>
        </div>
        </WalletProvider>
      </body>
    </html>
  );
}
