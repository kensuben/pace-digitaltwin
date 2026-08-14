import { apiError, apiSuccess } from "@/server/http/apiResponse";
import { simulateFailure } from "@/server/services/scenarioService";

export async function POST(request: Request) {
  try { return apiSuccess(await simulateFailure(await request.json())); }
  catch (error) { return apiError(error); }
}
