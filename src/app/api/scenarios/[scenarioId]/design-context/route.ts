import { apiError, apiSuccess } from "@/server/http/apiResponse";
import { getScenarioDesignContext } from "@/server/services/scenarioService";

export async function GET(_request: Request, context: { params: Promise<{ scenarioId: string }> }) {
  try {
    const { scenarioId } = await context.params;
    return apiSuccess(await getScenarioDesignContext(scenarioId));
  } catch (error) { return apiError(error); }
}
