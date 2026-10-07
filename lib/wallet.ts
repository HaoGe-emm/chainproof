import type { Address, EIP1193Provider } from "viem";
import { BOHR_RPC_URL, BOTSCAN_URL, bohrTestnet, publicClient } from "@/lib/chainproof";

export type MetaMaskProvider = EIP1193Provider & {
  isMetaMask?: boolean;
  providers?: MetaMaskProvider[];
};

export class WalletFlowError extends Error {}

export function getMetaMask(): MetaMaskProvider | null {
  if (typeof window === "undefined") return null;
  const injected = (window as Window & { ethereum?: MetaMaskProvider }).ethereum;
  return injected?.providers?.find((provider) => provider.isMetaMask) ?? (injected?.isMetaMask ? injected : null);
}

export function shortenAddress(address: Address): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function providerErrorCode(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const details = error as { code?: unknown; cause?: unknown };
  if (typeof details.code === "number") return details.code;
  return details.cause ? providerErrorCode(details.cause) : null;
}

export async function ensureBohrNetwork(provider: MetaMaskProvider): Promise<void> {
  const current = await provider.request({ method: "eth_chainId" });
  if (Number(current) !== bohrTestnet.id) {
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x3c8" }] });
    } catch (error) {
      if (providerErrorCode(error) !== 4902) {
        if (providerErrorCode(error) === 4001) throw new WalletFlowError("Network switch was declined.");
        throw new WalletFlowError("Could not switch to Bohr Testnet in MetaMask.");
      }
      try {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0x3c8",
            chainName: "Bohr Testnet",
            rpcUrls: [BOHR_RPC_URL],
            nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
            blockExplorerUrls: [BOTSCAN_URL],
          }],
        });
        if (Number(await provider.request({ method: "eth_chainId" })) !== bohrTestnet.id) {
          await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x3c8" }] });
        }
      } catch (addError) {
        if (providerErrorCode(addError) === 4001) throw new WalletFlowError("Network setup was declined.");
        throw new WalletFlowError("Could not add Bohr Testnet to MetaMask.");
      }
    }
  }

  if (Number(await provider.request({ method: "eth_chainId" })) !== bohrTestnet.id) {
    throw new WalletFlowError("Please switch MetaMask to Bohr Testnet.");
  }

  // Chain ID 968 can have another label in MetaMask. Compare genesis blocks to detect a different RPC.
  try {
    const [walletGenesis, bohrGenesis] = await Promise.all([
      provider.request({ method: "eth_getBlockByNumber", params: ["0x0", false] }),
      publicClient.getBlock({ blockNumber: BigInt(0) }),
    ]);
    if (!walletGenesis?.hash || walletGenesis.hash.toLowerCase() !== bohrGenesis.hash.toLowerCase()) {
      throw new WalletFlowError(`MetaMask's Chain ID 968 uses another network. Set its RPC to ${BOHR_RPC_URL}.`);
    }
  } catch (error) {
    if (error instanceof WalletFlowError) throw error;
    throw new WalletFlowError("Could not confirm Bohr Testnet RPC. Please try again.");
  }
}

export async function connectMetaMask(): Promise<{ account: Address; provider: MetaMaskProvider }> {
  const provider = getMetaMask();
  if (!provider) throw new WalletFlowError("MetaMask is required.");

  let accounts: readonly Address[];
  try {
    accounts = await provider.request({ method: "eth_requestAccounts" });
  } catch (error) {
    if (providerErrorCode(error) === 4001) throw new WalletFlowError("Wallet connection was declined.");
    throw new WalletFlowError("Could not connect to MetaMask.");
  }
  if (!accounts[0]) throw new WalletFlowError("No wallet account is available.");
  await ensureBohrNetwork(provider);
  return { account: accounts[0], provider };
}

export function friendlyChainError(error: unknown, fallback = "Contract call failed. Please try again."): string {
  if (error instanceof WalletFlowError) return error.message;
  if (providerErrorCode(error) === 4001) return "Transaction was declined.";
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("proof already exists")) return "This file already has a provenance proof.";
  if (message.includes("wrong chain")) return "Bohr RPC returned the wrong chain.";
  if (message.includes("http request") || message.includes("fetch failed") || message.includes("timeout") || message.includes("network error")) {
    return "Could not reach Bohr Testnet. Please try again.";
  }
  return fallback;
}
