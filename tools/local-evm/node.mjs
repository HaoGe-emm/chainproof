import { runtime } from "./runtime.mjs";
import { fileURLToPath } from "node:url";
import { refuseExistingDeployment } from "./setup-safety.mjs";
try { await refuseExistingDeployment(fileURLToPath(new URL("../../.local-evm/",import.meta.url))); }
catch(cause) { console.error(cause.message); process.exit(1); }
const hre = await runtime();
const server = await hre.network.createServer("local", "127.0.0.1", 8545);
await server.listen();
console.log("Isolated Hardhat local EVM: http://127.0.0.1:8545, chain 31337. No fork, no public RPC.");
const stop = async () => { await server.close(); process.exit(0); };
process.on("SIGINT", stop); process.on("SIGTERM", stop);
await server.afterClosed();
