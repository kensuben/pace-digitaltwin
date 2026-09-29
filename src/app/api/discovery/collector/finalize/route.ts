import { authenticateDiscovery } from "@/server/discovery/auth";
import { apiError, apiSuccess } from "@/server/http/apiResponse";
import { readDiscoveryJson } from "@/server/http/discoveryRequest";
import { DiscoveryService } from "@/server/services/discoveryService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const principal = authenticateDiscovery(request);
    return apiSuccess(await new DiscoveryService().finalize(await readDiscoveryJson(request), principal));
  } catch (error) { return apiError(error); }
}
