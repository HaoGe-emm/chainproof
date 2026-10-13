import { isAddress, type Address, type Hex } from "viem";
export const METAMASK_CHAIN_ID = 31338;
export const METAMASK_RPC = "http://127.0.0.1:18547";
export type MetaDeployment = { source: "metamask-local"; chainId: 31338; rpcUrl: string; session: string; original: Address; registry: Address; originalCodeHash: Hex; registryCodeHash: Hex; genesisHash: Hex; deploymentBlock: string; deploymentBlockHash: Hex; funder: Address; seededWorkId: string; samples: { name: string; hash: Hex }[] };
export function validateMetaDeployment(input: unknown): MetaDeployment {
  const b = input as MetaDeployment;
  const hash = (v: unknown) => typeof v === "string" && /^0x[0-9a-f]{64}$/i.test(v);
  const forbidden = ["0xc64cef65ccd720664cc3bfd7d970b6f866e53052", "0x5fbdb2315678afecb367f032d93f642f64180aa3", "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512"];
  if (!b || b.source !== "metamask-local" || b.chainId !== METAMASK_CHAIN_ID || b.rpcUrl !== METAMASK_RPC || !/^[0-9a-f-]{36}$/i.test(b.session) || ![b.original,b.registry,b.funder].every(v => isAddress(v) && !/^0x0{40}$/i.test(v)) || forbidden.some(v => v === b.original.toLowerCase() || v === b.registry.toLowerCase()) || b.original.toLowerCase() === b.registry.toLowerCase() || ![b.originalCodeHash,b.registryCodeHash,b.genesisHash,b.deploymentBlockHash].every(hash) || !/^[1-9][0-9]*$/.test(b.deploymentBlock) || !Array.isArray(b.samples) || !b.samples.every(v => typeof v.name === "string" && hash(v.hash))) throw new Error("Incorrect Local Configuration");
  return b;
}
