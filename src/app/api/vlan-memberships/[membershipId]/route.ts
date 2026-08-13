import { AppError } from "@/server/errors";
import { apiError, apiSuccess } from "@/server/http/apiResponse";
import {
  deleteMembership,
  updateMembership,
} from "@/server/services/networkConfigService";
function scenarioId(request: Request) {
  const value = new URL(request.url).searchParams.get("scenarioId");
  if (!value)
    throw new AppError("SCENARIO_REQUIRED", "scenarioId is required.", 400);
  return value;
}
export async function PATCH(
  request: Request,
  context: { params: Promise<{ membershipId: string }> },
) {
  try {
    const { membershipId } = await context.params;
    const body = await request.json().catch(() => {
      throw new AppError(
        "INVALID_JSON",
        "Request body must be valid JSON.",
        400,
      );
    });
    return apiSuccess(
      await updateMembership(scenarioId(request), membershipId, body),
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(
  request: Request,
  context: { params: Promise<{ membershipId: string }> },
) {
  try {
    const { membershipId } = await context.params;
    await deleteMembership(scenarioId(request), membershipId);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
