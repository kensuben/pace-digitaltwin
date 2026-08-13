import { AppError } from "@/server/errors";
import { apiError, apiSuccess } from "@/server/http/apiResponse";
import { mapDrawingPage } from "@/server/services/pdfIngestionService";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ pageId: string }> },
) {
  try {
    const { pageId } = await context.params;
    const body = await request
      .json()
      .catch(() =>
        Promise.reject(
          new AppError("INVALID_JSON", "Request body must be valid JSON.", 400),
        ),
      );
    return apiSuccess(await mapDrawingPage(pageId, body));
  } catch (error) {
    return apiError(error);
  }
}
