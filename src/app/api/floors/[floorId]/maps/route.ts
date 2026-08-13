import { AppError } from "@/server/errors";
import { apiCreated, apiError, apiSuccess } from "@/server/http/apiResponse";
import {
  createFloorMap,
  listFloorMaps,
} from "@/server/services/floorMapService";
export async function GET(
  request: Request,
  context: { params: Promise<{ floorId: string }> },
) {
  try {
    const { floorId } = await context.params;
    const scenarioId =
      new URL(request.url).searchParams.get("scenarioId") ?? "";
    return apiSuccess(await listFloorMaps(floorId, scenarioId));
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(
  request: Request,
  context: { params: Promise<{ floorId: string }> },
) {
  try {
    const { floorId } = await context.params;
    const body = await request.json().catch(() => {
      throw new AppError(
        "INVALID_JSON",
        "Request body must be valid JSON.",
        400,
      );
    });
    return apiCreated(await createFloorMap(floorId, body));
  } catch (error) {
    return apiError(error);
  }
}
