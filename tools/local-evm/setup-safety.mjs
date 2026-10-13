import { stat } from "node:fs/promises";
import path from "node:path";
export async function refuseExistingDeployment(directory) {
  try { await stat(path.join(directory,"deployment.json")); }
  catch(cause) { if(cause.code==="ENOENT") return; throw cause; }
  throw new Error("Existing deployment metadata is protected. Refusing fresh initialization/overwrite. Verify a backup and use resume:version:local after the old services are stopped by you.");
}
