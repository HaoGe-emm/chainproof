import { createHardhatRuntimeEnvironment } from "hardhat/hre";
import config from "./hardhat.config.mjs";
import { createPublicClient, createWalletClient, custom, defineChain, http } from "viem";
process.env.HARDHAT_DISABLE_TELEMETRY = "true";
export const rpc = "http://127.0.0.1:8545";
export const chain = defineChain({ id: 31337, name: "Isolated Local EVM", nativeCurrency: { name: "Development ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [rpc] } } });
export async function runtime() { return createHardhatRuntimeEnvironment(config); }
export function clients(provider) {
  const transport = provider ? custom(provider) : http(rpc, { retryCount: 0, timeout: 4000 });
  return { publicClient: createPublicClient({ chain, transport, pollingInterval: 50 }), wallet: (account) => createWalletClient({ account, chain, transport }) };
}
export async function assertLocal(client) {
  if (await client.getChainId() !== 31337) throw new Error("Only isolated chain 31337 is allowed.");
  const version = await client.request({ method: "web3_clientVersion" });
  if (!/hardhat|edr/i.test(version)) throw new Error("Expected isolated Hardhat EVM. Refusing deployment.");
}
