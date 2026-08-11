import { AppError } from "@/server/errors";
import { apiError, apiSuccess } from "@/server/http/apiResponse";
import {
  deleteCatalogModel,
  getCatalogModel,
  updateCatalogModel,
} from "@/server/services/catalogService";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ modelId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { modelId } = await context.params;
    return apiSuccess(await getCatalogModel(modelId));
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { modelId } = await context.params;
    const body = await request
      .json()
      .catch(() =>
        Promise.reject(
          new AppError("INVALID_JSON", "Request body must be valid JSON.", 400),
        ),
      );
    return apiSuccess(await updateCatalogModel(modelId, body));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { modelId } = await context.params;
    await deleteCatalogModel(modelId);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
