import { describe, expect, it, vi } from "vitest";

import type { SpatialPlanningRepository } from "@/server/repositories/spatialPlanningRepository";
import {
  createCableRoute,
  createRackPlacement,
  createRiser,
  createSpatialZone,
  deleteRackPlacement,
} from "@/server/services/spatialPlanningService";

function repository(overrides: Partial<SpatialPlanningRepository> = {}) {
  return {
    getScenario: vi
      .fn()
      .mockResolvedValue({ id: "scenario-1", isLocked: false }),
    validateZoneRefs: vi.fn().mockResolvedValue(true),
    validateRouteRefs: vi.fn().mockResolvedValue({
      valid: true,
      buildingIds: ["building-1"],
      riserFeatureIds: ["riser-feature"],
    }),
    validateBuilding: vi.fn().mockResolvedValue(true),
    createZone: vi.fn().mockResolvedValue({ id: "spatial-zone-1" }),
    updateZone: vi.fn(),
    createRoute: vi.fn().mockResolvedValue({ id: "route-1" }),
    updateRoute: vi.fn(),
    deleteRoute: vi.fn(),
    createRiser: vi.fn().mockResolvedValue({ id: "riser-1" }),
    validateRackPlacementRefs: vi.fn().mockResolvedValue(true),
    createRackPlacement: vi.fn().mockResolvedValue({ id: "rack-placement-1" }),
    updateRackPlacement: vi.fn(),
    deleteRackPlacement: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as SpatialPlanningRepository;
}

describe("spatialPlanningService", () => {
  it("calculates and persists manual zone area in floor-local meters", async () => {
    const repo = repository();
    await createSpatialZone(
      {
        scenarioId: "scenario-1",
        zoneId: "zone-1",
        floorId: "floor-1",
        floorMapId: "map-1",
        geometry: {
          type: "POLYGON",
          rings: [
            [
              { x: 0, y: 0 },
              { x: 4, y: 0 },
              { x: 4, y: 3 },
              { x: 0, y: 0 },
            ],
          ],
        },
      },
      "tester",
      repo,
    );
    expect(repo.createZone).toHaveBeenCalledWith(
      expect.objectContaining({ areaM2: 6, geometryType: "POLYGON" }),
      "tester",
    );
  });

  it("calculates 3D cable length and permits a cross-floor route using a riser", async () => {
    const repo = repository();
    await createCableRoute(
      {
        scenarioId: "scenario-1",
        routeType: "FIBER",
        points: [
          {
            floorId: "floor-1",
            xMeters: 0,
            yMeters: 0,
            zMeters: 0,
            featureId: "riser-feature",
          },
          {
            floorId: "floor-2",
            xMeters: 3,
            yMeters: 4,
            zMeters: 12,
            featureId: "riser-feature",
          },
        ],
      },
      "tester",
      repo,
    );
    expect(repo.createRoute).toHaveBeenCalledWith(
      expect.objectContaining({ calculatedLengthMeters: 13 }),
      "tester",
    );
  });

  it("rejects cross-floor routes without a riser or shaft", async () => {
    await expect(
      createCableRoute(
        {
          scenarioId: "scenario-1",
          routeType: "FIBER",
          points: [
            { floorId: "floor-1", xMeters: 0, yMeters: 0 },
            { floorId: "floor-2", xMeters: 1, yMeters: 1 },
          ],
        },
        "tester",
        repository({
          validateRouteRefs: vi.fn().mockResolvedValue({
            valid: true,
            buildingIds: ["building-1"],
            riserFeatureIds: [],
          }),
        }),
      ),
    ).rejects.toMatchObject({ code: "CROSS_FLOOR_RISER_REQUIRED" });
  });

  it("honors scenario locks for riser changes", async () => {
    await expect(
      createRiser(
        {
          scenarioId: "scenario-1",
          buildingId: "building-1",
          code: "R-01",
          name: "Data riser",
          type: "DATA",
        },
        "tester",
        repository({
          getScenario: vi
            .fn()
            .mockResolvedValue({ id: "scenario-1", isLocked: true }),
        }),
      ),
    ).rejects.toMatchObject({ code: "SCENARIO_LOCKED" });
  });

  it("places and removes a rack with physical dimensions", async () => {
    const repo = repository();
    await createRackPlacement(
      {
        rackId: "rack-1",
        zoneId: "zone-1",
        scenarioId: "scenario-1",
        floorId: "floor-1",
        floorMapId: "map-1",
        xMeters: 2,
        yMeters: 3,
      },
      "tester",
      repo,
    );
    expect(repo.createRackPlacement).toHaveBeenCalledWith(
      expect.objectContaining({
        widthMeters: 0.6,
        depthMeters: 1,
        heightMeters: 2,
      }),
      "tester",
    );
    await deleteRackPlacement("rack-placement-1", "scenario-1", "tester", repo);
    expect(repo.deleteRackPlacement).toHaveBeenCalledWith(
      "rack-placement-1",
      "scenario-1",
      "tester",
    );
  });

  it("rejects a rack outside its zone and floor hierarchy", async () => {
    await expect(
      createRackPlacement(
        {
          rackId: "rack-1",
          zoneId: "zone-1",
          scenarioId: "scenario-1",
          floorId: "wrong-floor",
          xMeters: 2,
          yMeters: 3,
        },
        "tester",
        repository({
          validateRackPlacementRefs: vi.fn().mockResolvedValue(false),
        }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_RACK_PLACEMENT_REFS" });
  });
});
