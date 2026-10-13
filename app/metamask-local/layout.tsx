import type { Metadata } from "next";
import { developmentFeatureEnabled } from "@/lib/development-features";
export const metadata: Metadata = { title: "MetaMask Local Test | ChainProof", robots: { index: false, follow: false } };
export default function MetaLocalLayout({children}:{children:React.ReactNode}) {
  if(!developmentFeatureEnabled("metamask-local"))return <div className="py-16"><h1 className="text-2xl font-semibold">MetaMask local testing disabled</h1><p className="mt-4 text-zinc-400">No local wallet or transaction controls are available in this build.</p></div>;
  return children;
}
