import { readFile } from "node:fs/promises";
import path from "node:path";
import { localHost, validateLocalDeployment } from "@/lib/local-evm-safety";
import { developmentFeatureEnabled } from "@/lib/development-features";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!developmentFeatureEnabled("local-evm") || !localHost(new URL(request.url).hostname)) return new Response("Local development only", { status: 404 });
  try {
    const manifest = validateLocalDeployment(JSON.parse(await readFile(path.join(process.cwd(), ".local-evm/deployment.json"), "utf8")));
    return Response.json(manifest, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Contract Not Deployed. Run setup:chain:local." }, { status: 503 }); }
}
