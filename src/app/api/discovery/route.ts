import { authenticateDiscovery } from "@/server/discovery/auth";
import { apiError, apiSuccess } from "@/server/http/apiResponse";
import { DiscoveryService } from "@/server/services/discoveryService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const principal = authenticateDiscovery(request);
    return apiSuccess(await new DiscoveryService().list(principal));
  } catch (error) { return apiError(error); }
}
