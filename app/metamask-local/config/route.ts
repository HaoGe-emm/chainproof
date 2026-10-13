import { readFile } from "node:fs/promises";
import path from "node:path";
import { localHost } from "@/lib/local-evm-safety";
import { validateMetaDeployment } from "@/lib/metamask-local-config";
import { developmentFeatureEnabled } from "@/lib/development-features";
export const dynamic="force-dynamic";
export async function GET(request:Request){
  if(!developmentFeatureEnabled("metamask-local") || !localHost(new URL(request.url).hostname))return new Response("Development only",{status:404});
  try{return Response.json(validateMetaDeployment(JSON.parse(await readFile(path.join(process.cwd(),".metamask-local/active.json"),"utf8"))),{headers:{"Cache-Control":"no-store"}});}catch{return Response.json({error:"Contract Not Found. Start dev:metamask:local."},{status:503});}
}
