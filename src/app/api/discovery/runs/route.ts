import { authenticateDiscovery } from "@/server/discovery/auth";
import { apiError } from "@/server/http/apiResponse";
import { readDiscoveryJson } from "@/server/http/discoveryRequest";
import { DiscoveryService } from "@/server/services/discoveryService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const principal = authenticateDiscovery(request);
    const run = await new DiscoveryService().createRun(await readDiscoveryJson(request, 16384), principal);
    return Response.json({ data: run, meta: {}, errors: [] }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
