import assert from "node:assert/strict";
import test from "node:test";
import { localHost, validateLocalDeployment } from "../lib/local-evm-safety.ts";
const base = { source: "local-evm", chainId: 31337, rpcUrl: "http://127.0.0.1:8545", original: "0x0000000000000000000000000000000000000002", registry: "0x0000000000000000000000000000000000000003", originalCodeHash: `0x${"a".repeat(64)}`, registryCodeHash: `0x${"b".repeat(64)}`, genesisHash: `0x${"c".repeat(64)}`, deploymentBlock: "2", deploymentBlockHash: `0x${"d".repeat(64)}`, accounts: ["0x0000000000000000000000000000000000000004", "0x0000000000000000000000000000000000000005"], samples: [], seededWorkId: "1" };
test("local manifest refuses public networks, remote RPCs, original mainnet address and placeholders", () => {
  assert.equal(validateLocalDeployment(base).chainId, 31337);
  for (const patch of [{ chainId: 677 }, { chainId: 968 }, { source: "mainnet" }, { rpcUrl: "https://rpc.botchain.ai" }, { rpcUrl: "http://localhost:8545" }, { original: "0xC64CEF65ccd720664cc3bfd7D970b6F866E53052" }, { registry: base.original }, { registry: "0x0000000000000000000000000000000000000000" }, { registryCodeHash: "0x" }, { deploymentBlock: "0" }, { accounts: [] }]) assert.throws(() => validateLocalDeployment({ ...base, ...patch }));
});
test("local development website is limited to exact loopback hostnames", () => {
  for (const host of ["localhost", "127.0.0.1", "[::1]"]) assert.equal(localHost(host), true);
  for (const host of ["localhost.attacker.com", "chainproof-two.vercel.app", "192.168.1.2", "0.0.0.0"]) assert.equal(localHost(host), false);
});
