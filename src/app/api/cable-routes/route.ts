import { AppError } from "@/server/errors";
import { apiCreated, apiError } from "@/server/http/apiResponse";
import { createCableRoute } from "@/server/services/spatialPlanningService";
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => {
      throw new AppError(
        "INVALID_JSON",
        "Request body must be valid JSON.",
        400,
      );
    });
    return apiCreated(await createCableRoute(body));
  } catch (error) {
    return apiError(error);
  }
}
