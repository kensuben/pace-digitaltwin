import { apiError, apiSuccess } from "@/server/http/apiResponse";
import { calculateNetworkStructure } from "@/server/services/networkStructureService";

export async function POST(_request: Request, context: { params: Promise<{ scenarioId: string }> }) {
  try { const { scenarioId } = await context.params; return apiSuccess(await calculateNetworkStructure(scenarioId)); }
  catch (error) { return apiError(error); }
}
