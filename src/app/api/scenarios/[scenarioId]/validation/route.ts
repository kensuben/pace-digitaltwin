import { apiError, apiSuccess } from "@/server/http/apiResponse";
import {
  listValidationFindings,
  validateScenario,
} from "@/server/services/validationService";
export async function GET(
  _request: Request,
  context: { params: Promise<{ scenarioId: string }> },
) {
  try {
    const { scenarioId } = await context.params;
    return apiSuccess(await listValidationFindings(scenarioId));
  } catch (error) {
    return apiError(error);
  }
}
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
