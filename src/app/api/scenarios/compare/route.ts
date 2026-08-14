import { apiError, apiSuccess } from "@/server/http/apiResponse";
import { compareScenarios } from "@/server/services/scenarioService";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return apiSuccess(await compareScenarios(url.searchParams.get("leftId") ?? "", url.searchParams.get("rightId") ?? ""));
  } catch (error) { return apiError(error); }
}
