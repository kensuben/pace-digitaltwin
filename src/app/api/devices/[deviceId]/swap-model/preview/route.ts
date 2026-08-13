import { AppError } from "@/server/errors";
import { apiError, apiSuccess } from "@/server/http/apiResponse";
import { previewModelSwap } from "@/server/services/modelSwapService";
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
    return apiSuccess(await previewModelSwap(deviceId, body));
  } catch (error) {
    return apiError(error);
  }
}
