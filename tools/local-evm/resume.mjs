// Explicit future resume only. Never attach to, stop, or reset an existing node.
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { root } from "./compile.mjs";
import { readBackup } from "./backup.mjs";
import { restoreFresh } from "./recovery.mjs";
let owned,next;
try {
  const file=process.argv[2]; if(!file) throw new Error("Usage: resume.mjs BACKUP.json [--start]. Default verifies only; --start requires both original ports to be free.");
  if(process.argv.slice(3).some((arg)=>arg!=="--start")) throw new Error("Only explicit --start is accepted; no external target or reset option exists.");
  const b=await readBackup(file);
  const existing=JSON.parse(await readFile(path.join(root,".local-evm/deployment.json"),"utf8"));
  for(const key of ["source","chainId","rpcUrl","original","registry","originalCodeHash","registryCodeHash","genesisHash","deploymentBlock","deploymentBlockHash"]) if(existing[key]!==b.config[key]) throw new Error(`Protected manifest differs at ${key}. Refusing to overwrite it.`);
  if(!process.argv.includes("--start")) {console.log(`Verified ${b.workCount} works/${b.versionCount} versions. No node started. Add --start only after you stop the previous services.`);process.exit(0);}
  const probe=createServer(); await new Promise((resolve,reject)=>{probe.once("error",reject);probe.listen(3002,"127.0.0.1",resolve);}); await new Promise((resolve)=>probe.close(resolve));
  owned=await restoreFresh(b,{port:8545,resumeOriginalPort:true}); // listen fails if occupied before any RPC write.
  if(!owned.report.allArchivedBlockHashesMatch) throw new Error("Exact history replay failed; existing manifest left untouched and no frontend started");
  next=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","--hostname","127.0.0.1","--port","3002"],{cwd:root,stdio:"inherit",env:{...process.env,CHAINPROOF_LOCAL_EVM:"1"}});
  console.log(`Verified original history through block ${b.head.number}; open http://127.0.0.1:3002/local-evm/works/4. No deployment metadata was overwritten. New edits remain in memory: run backup:chain:local before stopping.`);
  let stopping=false;
  const stop=async()=>{if(stopping)return;stopping=true;next.kill("SIGTERM");await owned.close();};
  process.on("SIGINT",stop);process.on("SIGTERM",stop);
  next.once("exit",async(code)=>{if(!stopping && code)process.exitCode=code;await owned.close();});
  await owned.afterClosed();
} catch(cause) {next?.kill("SIGTERM");if(owned)await owned.close();console.error(`Resume stopped safely: ${cause.shortMessage || cause.message}`);process.exitCode=1;}
