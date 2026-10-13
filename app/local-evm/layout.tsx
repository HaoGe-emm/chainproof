import type { Metadata } from "next";
import { developmentFeatureEnabled } from "@/lib/development-features";
export const metadata: Metadata = { title: "LOCAL EVM DEVELOPMENT | ChainProof", robots: { index: false, follow: false } };
export default function LocalLayout({ children }: { children: React.ReactNode }) {
  if (!developmentFeatureEnabled("local-evm")) return <div className="py-16"><h1 className="text-2xl font-semibold">Local EVM development disabled</h1><p className="mt-4 text-sm text-zinc-400">Version Registry is not deployed to BOT Chain Mainnet. No local wallet or write controls are available in this build.</p></div>;
  return children;
}
