import { apiError, apiSuccess } from "@/server/http/apiResponse";
import { getFloorSpatial } from "@/server/services/floorMapService";
export async function GET(
  request: Request,
  context: { params: Promise<{ floorId: string }> },
) {
  try {
    const { floorId } = await context.params;
    return apiSuccess(
      await getFloorSpatial(
        floorId,
        new URL(request.url).searchParams.get("scenarioId") ?? "",
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
