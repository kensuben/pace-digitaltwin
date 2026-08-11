import { AppError } from "@/server/errors";
import { apiCreated, apiError, apiSuccess } from "@/server/http/apiResponse";
import {
  createDrawingDocument,
  listDrawingDocuments,
  parseDrawingFilters,
} from "@/server/services/drawingService";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const drawings = await listDrawingDocuments(
      parseDrawingFilters({
        campusId: searchParams.get("campusId") ?? undefined,
        buildingId: searchParams.get("buildingId") ?? undefined,
        documentType: searchParams.get("documentType") ?? undefined,
        status: searchParams.get("status") ?? undefined,
        search: searchParams.get("search") ?? undefined,
      }),
    );
    return apiSuccess(drawings, { count: drawings.length });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request
      .json()
      .catch(() =>
        Promise.reject(
          new AppError("INVALID_JSON", "Request body must be valid JSON.", 400),
        ),
      );
    return apiCreated(await createDrawingDocument(body));
  } catch (error) {
    return apiError(error);
  }
}
