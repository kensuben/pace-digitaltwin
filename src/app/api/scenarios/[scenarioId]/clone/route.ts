import { apiCreated, apiError } from "@/server/http/apiResponse";
import { cloneScenario } from "@/server/services/scenarioService";

export async function POST(request: Request, context: { params: Promise<{ scenarioId: string }> }) {
  try {
    const { scenarioId } = await context.params;
    return apiCreated(await cloneScenario(scenarioId, await request.json()));
  } catch (error) { return apiError(error); }
}
