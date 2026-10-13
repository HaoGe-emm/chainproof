import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFile,mkdir,writeFile,stat } from "node:fs/promises";
import path from "node:path";
import { root } from "../local-evm/compile.mjs";
import { readBackup } from "../local-evm/backup.mjs";
import { createMetaNode } from "./runtime.mjs";
let owned,next;
try{
  await readBackup(path.join(root,".local-evm/backups/chain31337-2026-10-13T01-29-12-455Z-e0988bf6.json"));
  const dir=path.join(root,".metamask-local"),active=path.join(dir,"active.json");
  let exists=false;try{await stat(active);exists=true;}catch(cause){if(cause.code!=="ENOENT")throw cause;}
  if(exists && !process.argv.includes("--fresh"))throw new Error("Previous 31338 session metadata exists. Keep its files; use --fresh explicitly only after that session is stopped. Original 31337 is never affected.");
  const probe=createServer();await new Promise((resolve,reject)=>{probe.once("error",reject);probe.listen(3006,"127.0.0.1",resolve);});await new Promise(resolve=>probe.close(resolve));
  owned=await createMetaNode();const sessionDir=path.join(dir,"sessions",owned.manifest.session);await mkdir(sessionDir,{recursive:true});
  await writeFile(path.join(sessionDir,"deployment.json"),JSON.stringify(owned.manifest,null,2),{flag:"wx"});
  await writeFile(active,JSON.stringify(owned.manifest,null,2),{flag:exists?"w":"wx"}); // --fresh changes only this new-chain pointer; immutable session files remain.
  next=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","--hostname","127.0.0.1","--port","3006"],{cwd:root,stdio:"inherit",env:{...process.env,CHAINPROOF_METAMASK_LOCAL:"1",CHAINPROOF_LOCAL_EVM:"0"}});
  console.log(JSON.stringify({source:"METAMASK LOCAL TEST ONLY",chainId:31338,rpc:owned.manifest.rpcUrl,page:"http://127.0.0.1:3006/metamask-local",original:owned.manifest.original,registry:owned.manifest.registry,seededDeveloperWork:"1",manifest:path.join(sessionDir,"deployment.json")},null,2));
  let stopping=false;const stop=async()=>{if(stopping)return;stopping=true;next.kill("SIGTERM");await owned.close();};
  process.on("SIGINT",stop);process.on("SIGTERM",stop);next.once("exit",async(code)=>{if(!stopping && code)process.exitCode=code;await owned.close();});await owned.afterClosed();
}catch(cause){next?.kill("SIGTERM");if(owned)await owned.close();console.error(`MetaMask local startup stopped safely: ${cause.shortMessage||cause.message}`);process.exitCode=1;}
