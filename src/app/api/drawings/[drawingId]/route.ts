import { AppError } from "@/server/errors";
import { apiError, apiSuccess } from "@/server/http/apiResponse";
import {
  deleteDrawingDocument,
  updateDrawingDocument,
} from "@/server/services/drawingService";
import { getPdfDrawingDetail } from "@/server/services/pdfIngestionService";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ drawingId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { drawingId } = await context.params;
    return apiSuccess(await getPdfDrawingDetail(drawingId));
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { drawingId } = await context.params;
    const body = await request
      .json()
      .catch(() =>
        Promise.reject(
          new AppError("INVALID_JSON", "Request body must be valid JSON.", 400),
        ),
      );
    return apiSuccess(await updateDrawingDocument(drawingId, body));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { drawingId } = await context.params;
    await deleteDrawingDocument(drawingId);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
