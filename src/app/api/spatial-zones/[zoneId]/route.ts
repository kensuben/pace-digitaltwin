import { AppError } from "@/server/errors";
import { apiError, apiSuccess } from "@/server/http/apiResponse";
import { updateSpatialZone } from "@/server/services/spatialPlanningService";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ zoneId: string }> },
) {
  try {
    const { zoneId } = await context.params;
    const body = await request.json().catch(() => {
      throw new AppError(
        "INVALID_JSON",
        "Request body must be valid JSON.",
        400,
      );
    });
    return apiSuccess(await updateSpatialZone(zoneId, body));
  } catch (error) {
    return apiError(error);
  }
}
