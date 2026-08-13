import { AppError } from "@/server/errors";
import { apiCreated, apiError } from "@/server/http/apiResponse";
import { createPhysicalLink } from "@/server/services/topologyService";

export async function POST(request: Request) {
  try {
    const body = await request
      .json()
      .catch(() =>
        Promise.reject(
          new AppError("INVALID_JSON", "Request body must be valid JSON.", 400),
        ),
      );
    return apiCreated(await createPhysicalLink(body));
  } catch (error) {
    return apiError(error);
  }
}
