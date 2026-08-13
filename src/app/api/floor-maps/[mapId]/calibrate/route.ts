import { AppError } from "@/server/errors";
import { apiError, apiSuccess } from "@/server/http/apiResponse";
import { calibrateFloorMap } from "@/server/services/floorMapService";
export async function POST(
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
    return apiSuccess(await calibrateFloorMap(mapId, body));
  } catch (error) {
    return apiError(error);
  }
}
