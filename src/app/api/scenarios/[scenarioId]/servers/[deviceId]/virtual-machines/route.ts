import { AppError } from "@/server/errors";
import { apiCreated, apiError } from "@/server/http/apiResponse";
import { createVirtualMachine } from "@/server/services/virtualMachineService";

export async function POST(request: Request, context: { params: Promise<{ scenarioId: string; deviceId: string }> }) {
  try {
    const { scenarioId, deviceId } = await context.params;
    const body = await request.json().catch(() => { throw new AppError("INVALID_JSON", "Request body must be valid JSON.", 400); });
    return apiCreated(await createVirtualMachine(scenarioId, deviceId, body));
  } catch (error) {
    return apiError(error);
  }
}
