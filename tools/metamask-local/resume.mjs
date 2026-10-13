// Future restart from a verified archive only. Existing ports/manifests are protected.
import {spawn} from "node:child_process";
import {createServer} from "node:net";
import {readFile} from "node:fs/promises";
import {readMetaArchive} from "./archive.mjs";
import {restoreMetaFresh} from "./recover.mjs";
import {root} from "../local-evm/compile.mjs";
import path from "node:path";
let owned,next;
try{
  const file=process.argv[2];if(!file||process.argv.slice(3).some(a=>a!=="--start"))throw new Error("Usage: resume.mjs BACKUP [--start]; default verifies only");
  const b=await readMetaArchive(file),existing=JSON.parse(await readFile(path.join(root,".metamask-local/active.json"),"utf8"));
  for(const k of ["source","chainId","rpcUrl","session","original","registry","originalCodeHash","registryCodeHash","genesisHash","deploymentBlock","deploymentBlockHash"])if(existing[k]!==b.config[k])throw new Error(`Protected 31338 manifest differs at ${k}; not overwritten`);
  if(!process.argv.includes("--start")){console.log(`Verified 31338 ${b.workCount} works/${b.versionCount} versions through ${b.head.number}; no node started`);process.exit(0);}
  const probe=createServer();await new Promise((resolve,reject)=>{probe.once("error",reject);probe.listen(3006,"127.0.0.1",resolve);});await new Promise(resolve=>probe.close(resolve));
  owned=await restoreMetaFresh(b,{port:18547,resume:true});
  next=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","--hostname","127.0.0.1","--port","3006"],{cwd:root,stdio:"inherit",env:{...process.env,CHAINPROOF_METAMASK_LOCAL:"1",CHAINPROOF_LOCAL_EVM:"0"}});
  console.log(`Original 31338 history verified. http://127.0.0.1:3006/metamask-local?work=6 . Back up new transactions before stopping.`);
  let stopping=false;const stop=async()=>{if(stopping)return;stopping=true;next.kill("SIGTERM");await owned.close();};process.on("SIGINT",stop);process.on("SIGTERM",stop);next.once("exit",async code=>{if(!stopping&&code)process.exitCode=code;await owned.close();});await owned.afterClosed();
}catch(cause){next?.kill("SIGTERM");if(owned)await owned.close();console.error(`31338 resume refused safely: ${cause.shortMessage||cause.message}`);process.exitCode=1;}
