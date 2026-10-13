import solc from "solc";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
export const root = fileURLToPath(new URL("../../", import.meta.url));
export async function compile(extra = {}) {
  const names = ["ChainProof.sol", "ChainProofVersionRegistry.sol"];
  const sources = Object.fromEntries(await Promise.all(names.map(async (name) => [name, { content: await readFile(path.join(root, "contracts", name), "utf8") }])));
  const settings = { optimizer: { enabled: true, runs: 200 }, evmVersion: "shanghai", outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object", "storageLayout"] } } };
  const output = JSON.parse(solc.compile(JSON.stringify({ language: "Solidity", sources: { ...sources, ...extra }, settings })));
  for (const error of output.errors || []) { if (error.severity === "error") throw new Error(error.formattedMessage); console.warn(error.formattedMessage); }
  return { contracts: output.contracts, compiler: solc.version(), settings };
}
export async function saveArtifacts(result) {
  const dir = path.join(root, ".local-evm"); await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "artifacts.json"), JSON.stringify(result, null, 2));
  await writeFile(path.join(root, "lib/version-registry-abi.ts"), `// Generated from Solidity 0.8.20; do not edit by hand.\nexport const versionRegistryAbi = ${JSON.stringify(result.contracts["ChainProofVersionRegistry.sol"].ChainProofVersionRegistry.abi, null, 2)} as const;\n`);
  return dir;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) { const output = await compile(); await saveArtifacts(output); console.log(`Local Solidity compilation: ${output.compiler}, optimizer 200, Shanghai.`); }
