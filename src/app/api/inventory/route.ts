import { AppError } from "@/server/errors";
import { apiCreated, apiError, apiSuccess } from "@/server/http/apiResponse";
import {
  createInventoryDevice,
  listInventory,
  parseInventoryFilters,
} from "@/server/services/inventoryService";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const devices = await listInventory(
      parseInventoryFilters({
        scenarioId: searchParams.get("scenarioId") ?? undefined,
        search: searchParams.get("search") ?? undefined,
        category: searchParams.get("category") ?? undefined,
        status: searchParams.get("status") ?? undefined,
      }),
    );
    return apiSuccess(devices, { count: devices.length });
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
    return apiCreated(await createInventoryDevice(body));
  } catch (error) {
    return apiError(error);
  }
}
