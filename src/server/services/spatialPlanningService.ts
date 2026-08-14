import {
  cableRouteDtoSchema,
  rackPlacementDtoSchema,
  riserDtoSchema,
  spatialZoneDtoSchema,
} from "@/domain/spatial/schemas";
import { AppError } from "@/server/errors";
import {
  PrismaSpatialPlanningRepository,
  type CableRouteWrite,
  type SpatialPlanningRepository,
  type SpatialZoneWrite,
} from "@/server/repositories/spatialPlanningRepository";

function invalid(code: string, message: string, status = 400): never {
  throw new AppError(code, message, status);
}
function parse<T>(
  schema: {
    safeParse(
      input: unknown,
    ):
      | { success: true; data: T }
      | { success: false; error: { issues: Array<{ message: string }> } };
  },
  input: unknown,
  code: string,
): T {
  const result = schema.safeParse(input);
  if (!result.success)
    invalid(code, result.error.issues[0]?.message ?? "Invalid input.");
  return result.data;
}
async function mutable(
  scenarioId: string,
  repository: SpatialPlanningRepository,
) {
  const scenario = await repository.getScenario(scenarioId);
  if (!scenario) invalid("SCENARIO_NOT_FOUND", "Scenario was not found.", 404);
  if (scenario.isLocked)
    invalid("SCENARIO_LOCKED", "Locked scenarios cannot be changed.", 409);
}
function polygonArea(points: Array<{ x: number; y: number }>) {
  return (
    Math.abs(
      points.slice(0, -1).reduce((sum, point, index) => {
        const next = points[index + 1]!;
        return sum + point.x * next.y - next.x * point.y;
      }, 0),
    ) / 2
  );
}
function area(geometry: {
  type: string;
  rings?: Array<Array<{ x: number; y: number }>>;
  widthMeters?: number;
  heightMeters?: number;
}) {
  return geometry.type === "RECTANGLE"
    ? geometry.widthMeters! * geometry.heightMeters!
    : polygonArea(geometry.rings![0]!);
}
function length(points: CableRouteWrite["points"]) {
  return points.slice(1).reduce((sum, point, index) => {
    const previous = points[index]!;
    return (
      sum +
      Math.hypot(
        point.xMeters - previous.xMeters,
        point.yMeters - previous.yMeters,
        point.zMeters - previous.zMeters,
      )
    );
  }, 0);
}
function zoneWrite(
  value: ReturnType<typeof spatialZoneDtoSchema.parse>,
): SpatialZoneWrite {
  return {
    ...value,
    geometryType: value.geometry.type as "POLYGON" | "RECTANGLE",
    geometryJson: value.geometry,
    areaM2: area(value.geometry),
  };
}
async function validateZone(
  input: SpatialZoneWrite,
  repository: SpatialPlanningRepository,
) {
  if (input.areaM2 <= 0)
    invalid(
      "INVALID_ZONE_GEOMETRY",
      "Zone geometry must have a positive area.",
    );
  if (!(await repository.validateZoneRefs(input)))
    invalid(
      "INVALID_ZONE_REFS",
      "Zone and floor map must belong to the selected floor and scenario.",
      404,
    );
}
export async function createSpatialZone(
  input: unknown,
  actor = "local-admin",
  repository: SpatialPlanningRepository = new PrismaSpatialPlanningRepository(),
) {
  const value = parse(spatialZoneDtoSchema, input, "INVALID_SPATIAL_ZONE");
  await mutable(value.scenarioId, repository);
  const write = zoneWrite(value);
  await validateZone(write, repository);
  return repository.createZone(write, actor);
}
export async function updateSpatialZone(
  id: string,
  input: unknown,
  actor = "local-admin",
  repository: SpatialPlanningRepository = new PrismaSpatialPlanningRepository(),
) {
  const value = parse(spatialZoneDtoSchema, input, "INVALID_SPATIAL_ZONE");
  await mutable(value.scenarioId, repository);
  const write = zoneWrite(value);
  await validateZone(write, repository);
  const updated = await repository.updateZone(id, write, actor);
  if (!updated)
    invalid("SPATIAL_ZONE_NOT_FOUND", "Spatial zone was not found.", 404);
  return updated;
}
async function routeWrite(
  input: unknown,
  repository: SpatialPlanningRepository,
) {
  const value = parse(cableRouteDtoSchema, input, "INVALID_CABLE_ROUTE");
  await mutable(value.scenarioId, repository);
  const write: CableRouteWrite = {
    ...value,
    calculatedLengthMeters: length(value.points),
  };
  const refs = await repository.validateRouteRefs(write);
  if (!refs.valid || refs.buildingIds.length !== 1)
    invalid(
      "INVALID_CABLE_ROUTE_REFS",
      "Route points and endpoints must belong to one building and scenario.",
      404,
    );
  if (
    new Set(value.points.map((point) => point.floorId)).size > 1 &&
    refs.riserFeatureIds.length === 0
  )
    invalid(
      "CROSS_FLOOR_RISER_REQUIRED",
      "A cross-floor cable route must use a riser or shaft.",
      409,
    );
  return write;
}
export async function createCableRoute(
  input: unknown,
  actor = "local-admin",
  repository: SpatialPlanningRepository = new PrismaSpatialPlanningRepository(),
) {
  return repository.createRoute(await routeWrite(input, repository), actor);
}
export async function updateCableRoute(
  id: string,
  input: unknown,
  actor = "local-admin",
  repository: SpatialPlanningRepository = new PrismaSpatialPlanningRepository(),
) {
  const value = await routeWrite(input, repository);
  const updated = await repository.updateRoute(id, value, actor);
  if (!updated)
    invalid("CABLE_ROUTE_NOT_FOUND", "Cable route was not found.", 404);
  return updated;
}
export async function deleteCableRoute(
  id: string,
  scenarioId: string,
  actor = "local-admin",
  repository: SpatialPlanningRepository = new PrismaSpatialPlanningRepository(),
) {
  await mutable(scenarioId, repository);
  if (!(await repository.deleteRoute(id, scenarioId, actor)))
    invalid("CABLE_ROUTE_NOT_FOUND", "Cable route was not found.", 404);
}
export async function createRiser(
  input: unknown,
  actor = "local-admin",
  repository: SpatialPlanningRepository = new PrismaSpatialPlanningRepository(),
) {
  const value = parse(riserDtoSchema, input, "INVALID_RISER");
  await mutable(value.scenarioId, repository);
  if (!(await repository.validateBuilding(value.buildingId)))
    invalid("BUILDING_NOT_FOUND", "Building was not found.", 404);
  return repository.createRiser(value, actor);
}

async function rackPlacementWrite(
  input: unknown,
  repository: SpatialPlanningRepository,
) {
  const value = parse(rackPlacementDtoSchema, input, "INVALID_RACK_PLACEMENT");
  await mutable(value.scenarioId, repository);
  if (!(await repository.validateRackPlacementRefs(value)))
    invalid(
      "INVALID_RACK_PLACEMENT_REFS",
      "Rack, zone and floor map must belong to the selected floor and scenario.",
      404,
    );
  return value;
}

export async function createRackPlacement(
  input: unknown,
  actor = "local-admin",
  repository: SpatialPlanningRepository = new PrismaSpatialPlanningRepository(),
) {
  return repository.createRackPlacement(
    await rackPlacementWrite(input, repository),
    actor,
  );
}

export async function updateRackPlacement(
  id: string,
  input: unknown,
  actor = "local-admin",
  repository: SpatialPlanningRepository = new PrismaSpatialPlanningRepository(),
) {
  const value = await rackPlacementWrite(input, repository);
  const updated = await repository.updateRackPlacement(id, value, actor);
  if (!updated)
    invalid("RACK_PLACEMENT_NOT_FOUND", "Rack placement was not found.", 404);
  return updated;
}

export async function deleteRackPlacement(
  id: string,
  scenarioId: string,
  actor = "local-admin",
  repository: SpatialPlanningRepository = new PrismaSpatialPlanningRepository(),
) {
  await mutable(scenarioId, repository);
  if (!(await repository.deleteRackPlacement(id, scenarioId, actor)))
    invalid("RACK_PLACEMENT_NOT_FOUND", "Rack placement was not found.", 404);
}
