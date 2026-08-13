import { z } from "zod";

import {
  MountingType,
  PlacementAnchorType,
  PlacementStatus,
} from "@/generated/prisma/enums";
import {
  calculateMetersPerPdfPoint,
  createPdfToFloorTransform,
} from "@/domain/spatial/coordinates";
import { scaleCalibrationDtoSchema } from "@/domain/spatial/schemas";
import { AppError } from "@/server/errors";
import {
  PrismaFloorMapRepository,
  type FloorMapRepository,
} from "@/server/repositories/floorMapRepository";

const mapCreateSchema = z.object({
  scenarioId: z.string().min(1),
  drawingPageId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  opacity: z.number().min(0).max(1).default(1),
});
const mapUpdateSchema = z.object({
  scenarioId: z.string().min(1),
  name: z.string().trim().min(1).max(120).optional(),
  opacity: z.number().min(0).max(1).optional(),
  rotationDegrees: z.number().finite().optional(),
  isActive: z.boolean().optional(),
});
const placementSchema = z.object({
  deviceInstanceId: z.string().min(1),
  scenarioId: z.string().min(1),
  floorId: z.string().min(1),
  floorMapId: z.string().min(1).nullish(),
  xMeters: z.number().finite(),
  yMeters: z.number().finite(),
  zMeters: z.number().finite().default(0),
  rotationX: z.number().finite().default(0),
  rotationY: z.number().finite().default(0),
  rotationZ: z.number().finite().default(0),
  mountingType: z.enum(MountingType).default("VIRTUAL"),
  anchorType: z.enum(PlacementAnchorType).default("POINT"),
  placementStatus: z.enum(PlacementStatus).default("PLANNED"),
  notes: z.string().trim().max(500).nullish(),
});

function invalid(code: string, message: string, status = 400): never {
  throw new AppError(code, message, status);
}
function parse<T>(schema: z.ZodType<T>, input: unknown, code: string): T {
  const result = schema.safeParse(input);
  if (!result.success)
    invalid(code, result.error.issues[0]?.message ?? "Invalid input.");
  return result.data;
}
async function mutable(scenarioId: string, repository: FloorMapRepository) {
  const scenario = await repository.getScenario(scenarioId);
  if (!scenario) invalid("SCENARIO_NOT_FOUND", "Scenario was not found.", 404);
  if (scenario.isLocked)
    invalid("SCENARIO_LOCKED", "Locked scenarios cannot be changed.", 409);
}

export async function listFloorMaps(
  floorId: string,
  scenarioId: string,
  repository: FloorMapRepository = new PrismaFloorMapRepository(),
) {
  if (!scenarioId) invalid("SCENARIO_REQUIRED", "scenarioId is required.");
  const value = (await repository.listMaps(floorId, scenarioId)) as {
    floor: unknown;
  };
  if (!value.floor) invalid("FLOOR_NOT_FOUND", "Floor was not found.", 404);
  return value;
}
export async function getFloorSpatial(
  floorId: string,
  scenarioId: string,
  repository: FloorMapRepository = new PrismaFloorMapRepository(),
) {
  if (!scenarioId) invalid("SCENARIO_REQUIRED", "scenarioId is required.");
  const value = (await repository.getSpatial(floorId, scenarioId)) as {
    floor: unknown;
  };
  if (!value.floor) invalid("FLOOR_NOT_FOUND", "Floor was not found.", 404);
  return value;
}

export async function createFloorMap(
  floorId: string,
  input: unknown,
  actor = "local-admin",
  repository: FloorMapRepository = new PrismaFloorMapRepository(),
) {
  const value = parse(mapCreateSchema, input, "INVALID_FLOOR_MAP");
  await mutable(value.scenarioId, repository);
  if (!(await repository.getFloor(floorId)))
    invalid("FLOOR_NOT_FOUND", "Floor was not found.", 404);
  if (!(await repository.getDrawingPage(value.drawingPageId, floorId)))
    invalid(
      "DRAWING_PAGE_NOT_FOUND",
      "Drawing page must be mapped to this floor.",
      404,
    );
  return repository.createMap({ floorId, ...value }, actor);
}
export async function updateFloorMap(
  id: string,
  input: unknown,
  actor = "local-admin",
  repository: FloorMapRepository = new PrismaFloorMapRepository(),
) {
  const value = parse(mapUpdateSchema, input, "INVALID_FLOOR_MAP");
  await mutable(value.scenarioId, repository);
  const map = await repository.getMap(id);
  if (!map || map.scenarioId !== value.scenarioId)
    invalid("FLOOR_MAP_NOT_FOUND", "Floor map was not found.", 404);
  const { scenarioId, ...data } = value;
  void scenarioId;
  return repository.updateMap(id, data, actor);
}
export async function deleteFloorMap(
  id: string,
  scenarioId: string,
  actor = "local-admin",
  repository: FloorMapRepository = new PrismaFloorMapRepository(),
) {
  await mutable(scenarioId, repository);
  const map = await repository.getMap(id);
  if (!map || map.scenarioId !== scenarioId)
    invalid("FLOOR_MAP_NOT_FOUND", "Floor map was not found.", 404);
  if (!(await repository.deleteMap(id, actor)))
    invalid("FLOOR_MAP_NOT_FOUND", "Floor map was not found.", 404);
}

export async function calibrateFloorMap(
  id: string,
  input: unknown,
  actor = "local-admin",
  repository: FloorMapRepository = new PrismaFloorMapRepository(),
) {
  const raw = input as Record<string, unknown>;
  const scenarioId = typeof raw?.scenarioId === "string" ? raw.scenarioId : "";
  await mutable(scenarioId, repository);
  const value = parse(
    scaleCalibrationDtoSchema.omit({ floorMapId: true }),
    raw,
    "INVALID_CALIBRATION",
  );
  const map = await repository.getMap(id);
  if (!map || map.scenarioId !== scenarioId)
    invalid("FLOOR_MAP_NOT_FOUND", "Floor map was not found.", 404);
  const metersPerPdfPoint = calculateMetersPerPdfPoint(value);
  const transform = createPdfToFloorTransform(
    value.pointA,
    { x: 0, y: 0 },
    metersPerPdfPoint,
    map.rotationDegrees,
  );
  return repository.calibrate(
    id,
    { ...value, metersPerPdfPoint, transform, createdBy: value.createdBy },
    actor,
  );
}

async function validatePlacement(
  value: z.infer<typeof placementSchema>,
  repository: FloorMapRepository,
) {
  if (
    !(await repository.validatePlacementRefs({
      deviceInstanceId: value.deviceInstanceId,
      scenarioId: value.scenarioId,
      floorId: value.floorId,
      floorMapId: value.floorMapId ?? null,
    }))
  )
    invalid(
      "INVALID_PLACEMENT_REFS",
      "Device and floor map must belong to the selected scenario and floor.",
      404,
    );
}
export async function createPlacement(
  input: unknown,
  actor = "local-admin",
  repository: FloorMapRepository = new PrismaFloorMapRepository(),
) {
  const value = parse(placementSchema, input, "INVALID_PLACEMENT");
  await mutable(value.scenarioId, repository);
  await validatePlacement(value, repository);
  return repository.createPlacement(value, actor);
}
export async function updatePlacement(
  scenarioId: string,
  id: string,
  input: unknown,
  actor = "local-admin",
  repository: FloorMapRepository = new PrismaFloorMapRepository(),
) {
  const value = parse(
    placementSchema,
    { ...(input as object), scenarioId },
    "INVALID_PLACEMENT",
  );
  await mutable(scenarioId, repository);
  if (!(await repository.getPlacement(id, scenarioId)))
    invalid("PLACEMENT_NOT_FOUND", "Device placement was not found.", 404);
  await validatePlacement(value, repository);
  const { scenarioId: ignored, ...data } = value;
  void ignored;
  return repository.updatePlacement(id, scenarioId, data, actor);
}
export async function deletePlacement(
  scenarioId: string,
  id: string,
  actor = "local-admin",
  repository: FloorMapRepository = new PrismaFloorMapRepository(),
) {
  await mutable(scenarioId, repository);
  if (!(await repository.deletePlacement(id, scenarioId, actor)))
    invalid("PLACEMENT_NOT_FOUND", "Device placement was not found.", 404);
}
