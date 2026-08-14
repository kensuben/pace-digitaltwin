import { AppError } from "@/server/errors";
import { apiError, apiSuccess } from "@/server/http/apiResponse";
import {
  deleteRackPlacement,
  updateRackPlacement,
} from "@/server/services/spatialPlanningService";

function scenarioId(request: Request) {
  const value = new URL(request.url).searchParams.get("scenarioId");
  if (!value)
    throw new AppError("SCENARIO_REQUIRED", "scenarioId is required.", 400);
  return value;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ placementId: string }> },
) {
  try {
    const { placementId } = await context.params;
    const body = await request.json().catch(() => {
      throw new AppError(
        "INVALID_JSON",
        "Request body must be valid JSON.",
        400,
      );
    });
    return apiSuccess(await updateRackPlacement(placementId, body));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ placementId: string }> },
) {
  try {
    const { placementId } = await context.params;
    await deleteRackPlacement(placementId, scenarioId(request));
    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
