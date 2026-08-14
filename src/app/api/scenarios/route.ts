import { apiError, apiSuccess } from "@/server/http/apiResponse";
import { listScenarios } from "@/server/services/scenarioService";

export async function GET() {
  try { return apiSuccess(await listScenarios()); }
  catch (error) { return apiError(error); }
}
