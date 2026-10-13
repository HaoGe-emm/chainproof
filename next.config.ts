import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the isolated local EVM dev server separate from the existing product dev server.
  distDir: process.env.NODE_ENV === "development" && process.env.CHAINPROOF_METAMASK_LOCAL === "1" ? ".next-metamask-local" : process.env.CHAINPROOF_LOCAL_EVM === "1" && process.env.NODE_ENV === "development" ? ".next-local-evm" : ".next",
};

export default nextConfig;
