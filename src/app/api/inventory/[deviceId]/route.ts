import { AppError } from "@/server/errors";
import { apiError, apiSuccess } from "@/server/http/apiResponse";
import {
  deleteInventoryDevice,
  getInventoryDevice,
  updateInventoryDevice,
} from "@/server/services/inventoryService";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ deviceId: string }>;
}

function scenarioIdFrom(request: Request) {
  return new URL(request.url).searchParams.get("scenarioId") ?? "";
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { deviceId } = await context.params;
    return apiSuccess(
      await getInventoryDevice(scenarioIdFrom(request), deviceId),
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { deviceId } = await context.params;
    const body = await request
      .json()
      .catch(() =>
        Promise.reject(
          new AppError("INVALID_JSON", "Request body must be valid JSON.", 400),
        ),
      );
    return apiSuccess(
      await updateInventoryDevice(scenarioIdFrom(request), deviceId, body),
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { deviceId } = await context.params;
    await deleteInventoryDevice(scenarioIdFrom(request), deviceId);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
