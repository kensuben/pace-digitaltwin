import { apiError, apiSuccess } from "@/server/http/apiResponse";
import { getProjectCostSummary } from "@/server/services/projectCostService";

export async function GET(
  _request: Request,
  context: { params: Promise<{ scenarioId: string }> },
) {
  try {
    const { scenarioId } = await context.params;
    return apiSuccess(await getProjectCostSummary(scenarioId));
  } catch (error) {
    return apiError(error);
  }
}
