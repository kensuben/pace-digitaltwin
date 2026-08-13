import { AppError } from "@/server/errors";
import { apiError, apiSuccess } from "@/server/http/apiResponse";
import {
  deleteFloorMap,
  updateFloorMap,
} from "@/server/services/floorMapService";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ mapId: string }> },
) {
  try {
    const { mapId } = await context.params;
    const body = await request.json().catch(() => {
      throw new AppError(
        "INVALID_JSON",
        "Request body must be valid JSON.",
        400,
      );
    });
    return apiSuccess(await updateFloorMap(mapId, body));
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(
  request: Request,
  context: { params: Promise<{ mapId: string }> },
) {
  try {
    const { mapId } = await context.params;
    await deleteFloorMap(
      mapId,
      new URL(request.url).searchParams.get("scenarioId") ?? "",
    );
    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
