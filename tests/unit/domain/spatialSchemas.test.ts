import { describe, expect, it } from "vitest";

import {
  affineTransformSchema,
  devicePlacementDtoSchema,
  localGeometrySchema,
  rackPlacementDtoSchema,
  scaleCalibrationDtoSchema,
  cableRouteDtoSchema,
  spatialZoneDtoSchema,
} from "@/domain/spatial/schemas";

describe("spatial DTO schemas", () => {
  it("accepts versionable local geometry and canonical placement meters", () => {
    expect(
      localGeometrySchema.safeParse({
        type: "POLYGON",
        rings: [
          [
            { x: 0, y: 0 },
            { x: 2, y: 0 },
            { x: 2, y: 1 },
            { x: 0, y: 0 },
          ],
        ],
      }).success,
    ).toBe(true);
    expect(
      devicePlacementDtoSchema.parse({
        deviceInstanceId: "device-1",
        scenarioId: "scenario-1",
        floorId: "floor-1",
        xMeters: 1.25,
        yMeters: 2.5,
      }),
    ).toMatchObject({ zMeters: 0, rotationZ: 0 });
  });

  it("validates SP-3 zone and cable route payloads", () => {
    expect(
      spatialZoneDtoSchema.safeParse({
        scenarioId: "s",
        zoneId: "z",
        floorId: "f",
        floorMapId: "m",
        geometry: {
          type: "RECTANGLE",
          origin: { x: 0, y: 0 },
          widthMeters: 4,
          heightMeters: 3,
        },
      }).success,
    ).toBe(true);
    expect(
      cableRouteDtoSchema.parse({
        scenarioId: "s",
        routeType: "FIBER",
        points: [
          { floorId: "f", xMeters: 0, yMeters: 0 },
          { floorId: "f", xMeters: 1, yMeters: 1 },
        ],
      }),
    ).toMatchObject({ status: "PLANNED" });
  });

  it("defaults a rack footprint to a standard 600 mm cabinet", () => {
    expect(
      rackPlacementDtoSchema.parse({
        rackId: "rack-1",
        zoneId: "zone-1",
        scenarioId: "scenario-1",
        floorId: "floor-1",
        xMeters: 1,
        yMeters: 2,
      }),
    ).toMatchObject({
      widthMeters: 0.6,
      depthMeters: 1,
      heightMeters: 2,
      rotationDegrees: 0,
    });
  });

  it("rejects open polygons, non-finite transforms and invalid calibration", () => {
    expect(
      localGeometrySchema.safeParse({
        type: "POLYGON",
        rings: [
          [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
            { x: 0, y: 1 },
          ],
        ],
      }).success,
    ).toBe(false);
    expect(
      affineTransformSchema.safeParse({
        a: Number.NaN,
        b: 0,
        c: 0,
        d: 1,
        e: 0,
        f: 0,
      }).success,
    ).toBe(false);
    expect(
      scaleCalibrationDtoSchema.safeParse({
        floorMapId: "map-1",
        pointA: { x: 0, y: 0 },
        pointB: { x: 1, y: 0 },
        realDistanceMeters: -1,
        createdBy: "user",
      }).success,
    ).toBe(false);
  });
});
