import { z } from "zod";

import { DeviceCategory } from "@/generated/prisma/enums";
import { AppError } from "@/server/errors";
import { apiCreated, apiError, apiSuccess } from "@/server/http/apiResponse";
import {
  createCatalogModel,
  listCatalog,
} from "@/server/services/catalogService";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const category = z
      .enum(DeviceCategory)
      .safeParse(searchParams.get("category"));
    const models = await listCatalog({
      search: searchParams.get("search") ?? undefined,
      vendorId: searchParams.get("vendorId") ?? undefined,
      category: category.success ? category.data : undefined,
    });
    return apiSuccess(models, { count: models.length });
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
    return apiCreated(await createCatalogModel(body));
  } catch (error) {
    return apiError(error);
  }
}
