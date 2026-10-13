import type { Metadata } from "next";
import VersionPrototypeProvider from "@/components/version-prototype-provider";
import { developmentFeatureEnabled } from "@/lib/development-features";

export const metadata: Metadata = { title: "Version History Prototype | ChainProof", robots: { index: false, follow: false } };
export default function WorksLayout({ children }: { children: React.ReactNode }) {
  if (!developmentFeatureEnabled("prototype")) return <div className="py-16"><h1 className="text-2xl font-semibold">Version History unavailable</h1><p className="mt-4 text-sm leading-6 text-zinc-400">Version Registry is not deployed to BOT Chain Mainnet. Version History is a development feature and is not available in this release.</p></div>;
  return <VersionPrototypeProvider>{children}</VersionPrototypeProvider>;
}
