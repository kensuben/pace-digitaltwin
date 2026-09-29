import { authenticateDiscovery } from "@/server/discovery/auth";
import { apiError, apiSuccess } from "@/server/http/apiResponse";
import { DiscoveryService } from "@/server/services/discoveryService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const principal = authenticateDiscovery(request);
    const { runId } = await context.params;
    return apiSuccess(await new DiscoveryService().cancelRun(runId, principal));
  } catch (error) { return apiError(error); }
}
