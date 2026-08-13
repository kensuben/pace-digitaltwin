import { AppError } from "@/server/errors";
import { apiError, apiSuccess } from "@/server/http/apiResponse";
import {
  getTopology,
  updateTopologyPositions,
} from "@/server/services/topologyService";

export const dynamic = "force-dynamic";

async function readJson(request: Request) {
  return request
    .json()
    .catch(() =>
      Promise.reject(
        new AppError("INVALID_JSON", "Request body must be valid JSON.", 400),
      ),
    );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ scenarioId: string }> },
) {
  try {
    const { scenarioId } = await context.params;
    return apiSuccess(await getTopology(scenarioId));
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ scenarioId: string }> },
) {
  try {
    const { scenarioId } = await context.params;
    await updateTopologyPositions(scenarioId, await readJson(request));
    return apiSuccess({ saved: true });
  } catch (error) {
    return apiError(error);
  }
}
