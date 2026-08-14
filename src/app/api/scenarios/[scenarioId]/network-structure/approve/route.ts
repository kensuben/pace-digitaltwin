import { apiError, apiSuccess } from "@/server/http/apiResponse";
import { approveNetworkStructure } from "@/server/services/networkStructureService";

export async function POST(
  _request: Request,
  context: { params: Promise<{ scenarioId: string }> },
) {
  try {
    const { scenarioId } = await context.params;
    return apiSuccess(await approveNetworkStructure(scenarioId));
  } catch (error) {
    return apiError(error);
  }
}
