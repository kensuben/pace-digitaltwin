import { AppError } from "@/server/errors";
import { apiError, apiSuccess } from "@/server/http/apiResponse";
import { placeDeviceInRack } from "@/server/services/rackDesignService";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ scenarioId: string; deviceId: string }> },
) {
  try {
    const { scenarioId, deviceId } = await context.params;
    const body = await request.json().catch(() => {
      throw new AppError("INVALID_JSON", "Request body must be valid JSON.", 400);
    });
    return apiSuccess(await placeDeviceInRack(scenarioId, deviceId, body));
  } catch (error) {
    return apiError(error);
  }
}
