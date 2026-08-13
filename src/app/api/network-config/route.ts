import { AppError } from "@/server/errors";
import { apiError, apiSuccess } from "@/server/http/apiResponse";
import { getNetworkConfig } from "@/server/services/networkConfigService";

export async function GET(request: Request) {
  try {
    const scenarioId = new URL(request.url).searchParams.get("scenarioId");
    if (!scenarioId)
      throw new AppError("SCENARIO_REQUIRED", "scenarioId is required.", 400);
    return apiSuccess(await getNetworkConfig(scenarioId));
  } catch (error) {
    return apiError(error);
  }
}
