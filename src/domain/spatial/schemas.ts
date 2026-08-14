import { z } from "zod";

const coordinate = z.number().finite().min(-1_000_000).max(1_000_000);

export const localPointSchema = z.object({
  x: coordinate,
  y: coordinate,
});

const closedRingSchema = z
  .array(localPointSchema)
  .min(4)
  .refine((points) => {
    const first = points[0];
    const last = points.at(-1);
    return first?.x === last?.x && first?.y === last?.y;
  }, "Polygon rings must be closed.");

export const localGeometrySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("POINT"), point: localPointSchema }),
  z.object({
    type: z.literal("LINE_STRING"),
    points: z.array(localPointSchema).min(2),
  }),
  z.object({
    type: z.literal("POLYGON"),
    rings: z.array(closedRingSchema).min(1),
  }),
  z.object({
    type: z.literal("RECTANGLE"),
    origin: localPointSchema,
    widthMeters: z.number().finite().positive().max(1_000_000),
    heightMeters: z.number().finite().positive().max(1_000_000),
  }),
]);

export const affineTransformSchema = z.object({
  a: z.number().finite(),
  b: z.number().finite(),
  c: z.number().finite(),
  d: z.number().finite(),
  e: z.number().finite(),
  f: z.number().finite(),
});

export const scaleCalibrationDtoSchema = z.object({
  floorMapId: z.string().min(1),
  pointA: localPointSchema,
  pointB: localPointSchema,
  realDistanceMeters: z.number().finite().positive().max(1_000_000),
  createdBy: z.string().trim().min(1).max(120),
});

export const devicePlacementDtoSchema = z.object({
  deviceInstanceId: z.string().min(1),
  scenarioId: z.string().min(1),
  floorId: z.string().min(1),
  floorMapId: z.string().min(1).optional().nullable(),
  xMeters: coordinate,
  yMeters: coordinate,
  zMeters: coordinate.default(0),
  rotationX: z.number().finite().default(0),
  rotationY: z.number().finite().default(0),
  rotationZ: z.number().finite().default(0),
});

export const spatialZoneDtoSchema = z.object({
  scenarioId: z.string().min(1),
  zoneId: z.string().min(1),
  floorId: z.string().min(1),
  floorMapId: z.string().min(1),
  geometry: localGeometrySchema.refine(
    (value) => value.type === "POLYGON" || value.type === "RECTANGLE",
    "A spatial zone must be a polygon or rectangle.",
  ),
  labelX: coordinate.optional().nullable(),
  labelY: coordinate.optional().nullable(),
});

export const riserDtoSchema = z.object({
  scenarioId: z.string().min(1),
  buildingId: z.string().min(1),
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  type: z.enum(["DATA", "POWER", "FIRE", "HVAC", "MIXED"]),
  xMeters: coordinate.optional().nullable(),
  yMeters: coordinate.optional().nullable(),
});

export const cableRouteDtoSchema = z.object({
  scenarioId: z.string().min(1),
  physicalLinkId: z.string().min(1).optional().nullable(),
  routeType: z.enum(["COPPER", "FIBER", "DAC", "AOC", "POWER", "OTHER"]),
  sourceDeviceId: z.string().min(1).optional().nullable(),
  targetDeviceId: z.string().min(1).optional().nullable(),
  status: z.enum(["PLANNED", "INSTALLED", "VERIFIED"]).default("PLANNED"),
  points: z
    .array(
      z.object({
        floorId: z.string().min(1),
        xMeters: coordinate,
        yMeters: coordinate,
        zMeters: coordinate.default(0),
        featureId: z.string().min(1).optional().nullable(),
        riserId: z.string().min(1).optional().nullable(),
      }),
    )
    .min(2),
});

export const rackPlacementDtoSchema = z.object({
  rackId: z.string().min(1),
  zoneId: z.string().min(1),
  scenarioId: z.string().min(1),
  floorId: z.string().min(1),
  floorMapId: z.string().min(1).optional().nullable(),
  xMeters: coordinate,
  yMeters: coordinate,
  zMeters: coordinate.default(0),
  widthMeters: z.number().finite().positive().max(10).default(0.6),
  depthMeters: z.number().finite().positive().max(10).default(1),
  heightMeters: z.number().finite().positive().max(10).default(2),
  rotationDegrees: z.number().finite().default(0),
});
