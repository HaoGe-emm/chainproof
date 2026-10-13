import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { runtime } from "./runtime.mjs";
import { setup } from "./setup.mjs";
import { refuseExistingDeployment } from "./setup-safety.mjs";
import path from "node:path";
const root = fileURLToPath(new URL("../../", import.meta.url));
try { await refuseExistingDeployment(path.join(root,".local-evm")); }
catch(cause) { console.error(cause.message); process.exit(1); }
// Own both processes; fail on occupied ports instead of killing unrelated services.
const probe = createServer();
await new Promise((resolve, reject) => { probe.once("error", reject); probe.listen(3002, "127.0.0.1", resolve); });
await new Promise((resolve) => probe.close(resolve));
const hre = await runtime();
const server = await hre.network.createServer("local", "127.0.0.1", 8545);
await server.listen();
let next;
try {
  await setup();
  next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3002"], { cwd: root, stdio: "inherit", env: { ...process.env, CHAINPROOF_LOCAL_EVM: "1" } });
  console.log("Open http://127.0.0.1:3002/local-evm/works (LOCAL ONLY). Ctrl+C stops this app and its EVM.");
  let stopping = false;
  async function stop() { if (stopping) return; stopping = true; next.kill("SIGTERM"); await server.close(); }
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
  next.once("exit", async (code) => { if (!stopping && code) process.exitCode = code; await server.close(); });
  await server.afterClosed();
} catch (error) { await server.close(); throw error; }
