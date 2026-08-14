import { AppError } from "@/server/errors";
import { apiError, apiSuccess } from "@/server/http/apiResponse";
import {
  deleteCableRoute,
  updateCableRoute,
} from "@/server/services/spatialPlanningService";
function scenarioId(request: Request) {
  const value = new URL(request.url).searchParams.get("scenarioId");
  if (!value)
    throw new AppError("SCENARIO_REQUIRED", "scenarioId is required.", 400);
  return value;
}
export async function PATCH(
  request: Request,
  context: { params: Promise<{ routeId: string }> },
) {
  try {
    const { routeId } = await context.params;
    const body = await request.json().catch(() => {
      throw new AppError(
        "INVALID_JSON",
        "Request body must be valid JSON.",
        400,
      );
    });
    return apiSuccess(await updateCableRoute(routeId, body));
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(
  request: Request,
  context: { params: Promise<{ routeId: string }> },
) {
  try {
    const { routeId } = await context.params;
    await deleteCableRoute(routeId, scenarioId(request));
    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
