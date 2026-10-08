"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Address } from "viem";
import { botChainMainnet } from "@/lib/chainproof";
import { connectMetaMask, friendlyChainError, getMetaMask, shortenAddress, type MetaMaskProvider } from "@/lib/wallet";

type WalletContextValue = {
  address: Address | null;
  chainId: number | null;
  connecting: boolean;
  metaMaskAvailable: boolean | null;
  error: string;
  connect: () => Promise<{ account: Address; provider: MetaMaskProvider }>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [metaMaskAvailable, setMetaMaskAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const provider = getMetaMask();
    setMetaMaskAvailable(Boolean(provider));
    if (!provider) return;

    const accountsChanged = (accounts: Address[]) => {
      setAddress(accounts[0] ?? null);
      setError("");
    };
    const chainChanged = (chain: string) => setChainId(Number(chain));

    provider.on("accountsChanged", accountsChanged);
    provider.on("chainChanged", chainChanged);
    void provider.request({ method: "eth_accounts" }).then(accountsChanged).catch(() => {});
    void provider.request({ method: "eth_chainId" }).then(chainChanged).catch(() => {});
    return () => {
      provider.removeListener("accountsChanged", accountsChanged);
      provider.removeListener("chainChanged", chainChanged);
    };
  }, []);

  async function connect() {
    setConnecting(true);
    setError("");
    try {
      const result = await connectMetaMask();
      setAddress(result.account);
      setChainId(botChainMainnet.id);
      return result;
    } catch (cause) {
      setError(friendlyChainError(cause, "Could not connect to MetaMask."));
      throw cause;
    } finally {
      setConnecting(false);
    }
  }

  return (
    <WalletContext.Provider value={{ address, chainId, connecting, metaMaskAvailable, error, connect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const value = useContext(WalletContext);
  if (!value) throw new Error("WalletProvider is missing.");
  return value;
}

export function WalletStatus() {
  const { address, chainId, connecting, metaMaskAvailable, error, connect } = useWallet();

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button type="button" disabled={connecting || metaMaskAvailable === false} onClick={() => void connect().catch(() => {})} className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50">
        {connecting ? "Connecting…" : address ? shortenAddress(address) : "Connect Wallet"}
      </button>
      <div aria-live="polite" className="max-w-56 text-right text-[11px] leading-4 text-zinc-400">
        {metaMaskAvailable === false ? "MetaMask is required." : error || (address && chainId !== null && chainId !== botChainMainnet.id ? "Wrong network · click wallet to switch" : "")}
      </div>
    </div>
  );
}
