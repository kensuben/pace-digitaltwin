import { AppError } from "@/server/errors";
import { apiError, apiSuccess } from "@/server/http/apiResponse";
import { deleteVirtualMachine, updateVirtualMachine } from "@/server/services/virtualMachineService";

type Context = { params: Promise<{ scenarioId: string; deviceId: string; vmId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const { scenarioId, deviceId, vmId } = await context.params;
    const body = await request.json().catch(() => { throw new AppError("INVALID_JSON", "Request body must be valid JSON.", 400); });
    return apiSuccess(await updateVirtualMachine(scenarioId, deviceId, vmId, body));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { scenarioId, deviceId, vmId } = await context.params;
    await deleteVirtualMachine(scenarioId, deviceId, vmId);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
