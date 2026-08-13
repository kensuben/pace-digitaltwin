import { AppError } from "@/server/errors";
import { apiError, apiSuccess } from "@/server/http/apiResponse";
import { commitModelSwap } from "@/server/services/modelSwapService";
export async function POST(
  request: Request,
  context: { params: Promise<{ deviceId: string }> },
) {
  try {
    const { deviceId } = await context.params;
    const body = await request.json().catch(() => {
      throw new AppError(
        "INVALID_JSON",
        "Request body must be valid JSON.",
        400,
      );
    });
    return apiSuccess(await commitModelSwap(deviceId, body));
  } catch (error) {
    return apiError(error);
  }
}
