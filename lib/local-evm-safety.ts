import { isAddress, type Address, type Hex } from "viem";
export const LOCAL_EVM_ID = 31337;
export const LOCAL_EVM_RPC = "http://127.0.0.1:8545";
const MAINNET_ORIGINAL = "0xc64cef65ccd720664cc3bfd7d970b6f866e53052";
export type LocalDeployment = {
  source: "local-evm"; chainId: 31337; rpcUrl: string; original: Address; registry: Address;
  originalCodeHash: Hex; registryCodeHash: Hex; genesisHash: Hex; deploymentBlock: string; deploymentBlockHash: Hex;
  accounts: Address[]; samples: { hash: Hex; owner: Address; name: string }[]; seededWorkId: string;
};
export function localHost(host: string): boolean { return host === "localhost" || host === "127.0.0.1" || host === "[::1]"; }
export function validateLocalDeployment(input: unknown): LocalDeployment {
  const value = input as LocalDeployment;
  const hex = (v: unknown) => typeof v === "string" && /^0x[0-9a-fA-F]{64}$/.test(v);
  if (!value || value.source !== "local-evm" || value.chainId !== LOCAL_EVM_ID || value.rpcUrl !== LOCAL_EVM_RPC ||
    !isAddress(value.original) || !isAddress(value.registry) || value.original.toLowerCase() === MAINNET_ORIGINAL || value.registry.toLowerCase() === MAINNET_ORIGINAL ||
    value.original.toLowerCase() === value.registry.toLowerCase() || /^0x0{40}$/i.test(value.registry) || /^0x0{40}$/i.test(value.original) ||
    ![value.originalCodeHash, value.registryCodeHash, value.genesisHash, value.deploymentBlockHash].every(hex) ||
    !/^[1-9][0-9]*$/.test(value.deploymentBlock) || !/^[1-9][0-9]*$/.test(value.seededWorkId) ||
    !Array.isArray(value.accounts) || value.accounts.length < 2 || !value.accounts.every((address) => isAddress(address)) ||
    !Array.isArray(value.samples) || value.samples.length > 20 || !value.samples.every((sample) => sample && hex(sample.hash) && isAddress(sample.owner) && typeof sample.name === "string" && sample.name.length <= 120)) {
    throw new Error("Invalid local deployment configuration. Public networks and placeholder addresses are not allowed.");
  }
  return value;
}
