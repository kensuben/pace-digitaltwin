import { apiError, apiSuccess } from "@/server/http/apiResponse";
import { validateScenario } from "@/server/services/validationService";

export async function POST(
  _request: Request,
  context: { params: Promise<{ scenarioId: string }> },
) {
  try {
    const { scenarioId } = await context.params;
    return apiSuccess(await validateScenario(scenarioId));
  } catch (error) {
    return apiError(error);
  }
}
