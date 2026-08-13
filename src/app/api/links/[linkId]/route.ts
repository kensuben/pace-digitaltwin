import { AppError } from "@/server/errors";
import { apiError, apiSuccess } from "@/server/http/apiResponse";
import {
  deletePhysicalLink,
  updatePhysicalLink,
} from "@/server/services/topologyService";

function scenarioId(request: Request) {
  const value = new URL(request.url).searchParams.get("scenarioId");
  if (!value)
    throw new AppError("SCENARIO_REQUIRED", "scenarioId is required.", 400);
  return value;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ linkId: string }> },
) {
  try {
    const { linkId } = await context.params;
    const body = await request
      .json()
      .catch(() =>
        Promise.reject(
          new AppError("INVALID_JSON", "Request body must be valid JSON.", 400),
        ),
      );
    return apiSuccess(
      await updatePhysicalLink(scenarioId(request), linkId, body),
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ linkId: string }> },
) {
  try {
    const { linkId } = await context.params;
    await deletePhysicalLink(scenarioId(request), linkId);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
