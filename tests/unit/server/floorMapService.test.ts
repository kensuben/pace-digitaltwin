import { describe, expect, it, vi } from "vitest";

import type { FloorMapRepository } from "@/server/repositories/floorMapRepository";
import {
  calibrateFloorMap,
  createFloorMap,
  createPlacement,
  deleteFloorMap,
  deletePlacement,
  getFloorSpatial,
  listFloorMaps,
  updateFloorMap,
  updatePlacement,
} from "@/server/services/floorMapService";

function repository(overrides: Partial<FloorMapRepository> = {}) {
  return {
    getScenario: vi
      .fn()
      .mockResolvedValue({ id: "scenario-a", isLocked: false }),
    getFloor: vi
      .fn()
      .mockResolvedValue({ id: "floor-1", buildingId: "building-1" }),
    getDrawingPage: vi
      .fn()
      .mockResolvedValue({ id: "page-1", widthPoints: 200, heightPoints: 100 }),
    listMaps: vi
      .fn()
      .mockResolvedValue({ floor: { id: "floor-1" }, pages: [], maps: [] }),
    getMap: vi.fn().mockResolvedValue({
      id: "map-1",
      scenarioId: "scenario-a",
      floorId: "floor-1",
      rotationDegrees: 0,
    }),
    createMap: vi.fn().mockResolvedValue({ id: "map-1" }),
    updateMap: vi.fn(),
    deleteMap: vi.fn().mockResolvedValue(true),
    calibrate: vi.fn().mockResolvedValue({ id: "map-1" }),
    getSpatial: vi.fn().mockResolvedValue({
      floor: { id: "floor-1" },
      maps: [],
      placements: [],
      devices: [],
    }),
    getPlacement: vi.fn().mockResolvedValue({ id: "placement-1" }),
    validatePlacementRefs: vi.fn().mockResolvedValue(true),
    createPlacement: vi.fn().mockResolvedValue({ id: "placement-1" }),
    updatePlacement: vi.fn().mockResolvedValue({ id: "placement-1" }),
    deletePlacement: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as FloorMapRepository;
}

const placement = {
  deviceInstanceId: "device-1",
  scenarioId: "scenario-a",
  floorId: "floor-1",
  floorMapId: "map-1",
  xMeters: 4,
  yMeters: 6,
};

describe("floorMapService", () => {
  it("creates a map only from a page mapped to the floor", async () => {
    const repo = repository();
    await createFloorMap(
      "floor-1",
      { scenarioId: "scenario-a", drawingPageId: "page-1", name: "Level 1" },
      "tester",
      repo,
    );
    expect(repo.createMap).toHaveBeenCalledWith(
      expect.objectContaining({ floorId: "floor-1", opacity: 1 }),
      "tester",
    );
    await expect(
      createFloorMap(
        "floor-1",
        { scenarioId: "scenario-a", drawingPageId: "missing", name: "X" },
        "tester",
        repository({ getDrawingPage: vi.fn().mockResolvedValue(null) }),
      ),
    ).rejects.toMatchObject({ code: "DRAWING_PAGE_NOT_FOUND" });
  });

  it("persists two-point calibration and affine transform", async () => {
    const repo = repository();
    await calibrateFloorMap(
      "map-1",
      {
        scenarioId: "scenario-a",
        pointA: { x: 10, y: 10 },
        pointB: { x: 110, y: 10 },
        realDistanceMeters: 20,
        createdBy: "tester",
      },
      "tester",
      repo,
    );
    expect(repo.calibrate).toHaveBeenCalledWith(
      "map-1",
      expect.objectContaining({
        metersPerPdfPoint: 0.2,
        transform: expect.objectContaining({ a: 0.2, d: 0.2 }),
      }),
      "tester",
    );
  });

  it("lists, updates and deletes floor maps in the selected scenario", async () => {
    const repo = repository();
    await expect(
      listFloorMaps("floor-1", "scenario-a", repo),
    ).resolves.toMatchObject({ floor: { id: "floor-1" } });
    await updateFloorMap(
      "map-1",
      { scenarioId: "scenario-a", opacity: 0.5, isActive: true },
      "tester",
      repo,
    );
    await deleteFloorMap("map-1", "scenario-a", "tester", repo);
    expect(repo.updateMap).toHaveBeenCalledWith(
      "map-1",
      { opacity: 0.5, isActive: true },
      "tester",
    );
    expect(repo.deleteMap).toHaveBeenCalledWith("map-1", "tester");
  });

  it("runs placement create, update and delete in canonical meters", async () => {
    const repo = repository();
    await createPlacement(placement, "tester", repo);
    await updatePlacement(
      "scenario-a",
      "placement-1",
      { ...placement, xMeters: 8 },
      "tester",
      repo,
    );
    await deletePlacement("scenario-a", "placement-1", "tester", repo);
    expect(repo.createPlacement).toHaveBeenCalledWith(
      expect.objectContaining({ xMeters: 4, zMeters: 0 }),
      "tester",
    );
    expect(repo.updatePlacement).toHaveBeenCalledWith(
      "placement-1",
      "scenario-a",
      expect.objectContaining({ xMeters: 8 }),
      "tester",
    );
    expect(repo.deletePlacement).toHaveBeenCalledWith(
      "placement-1",
      "scenario-a",
      "tester",
    );
  });

  it("rejects locked scenarios and cross-floor placement references", async () => {
    await expect(
      createPlacement(
        placement,
        "tester",
        repository({
          getScenario: vi
            .fn()
            .mockResolvedValue({ id: "scenario-a", isLocked: true }),
        }),
      ),
    ).rejects.toMatchObject({ code: "SCENARIO_LOCKED" });
    await expect(
      createPlacement(
        placement,
        "tester",
        repository({ validatePlacementRefs: vi.fn().mockResolvedValue(false) }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_PLACEMENT_REFS" });
  });

  it("returns the floor spatial read model and rejects missing floors", async () => {
    await expect(
      getFloorSpatial("floor-1", "scenario-a", repository()),
    ).resolves.toMatchObject({ floor: { id: "floor-1" } });
    await expect(
      getFloorSpatial(
        "missing",
        "scenario-a",
        repository({ getSpatial: vi.fn().mockResolvedValue({ floor: null }) }),
      ),
    ).rejects.toMatchObject({ code: "FLOOR_NOT_FOUND" });
  });

  it.each([
    ["SCENARIO_REQUIRED", () => listFloorMaps("floor-1", "", repository())],
    [
      "FLOOR_NOT_FOUND",
      () =>
        listFloorMaps(
          "missing",
          "scenario-a",
          repository({ listMaps: vi.fn().mockResolvedValue({ floor: null }) }),
        ),
    ],
    ["SCENARIO_REQUIRED", () => getFloorSpatial("floor-1", "", repository())],
    [
      "INVALID_FLOOR_MAP",
      () => createFloorMap("floor-1", {}, "tester", repository()),
    ],
    [
      "FLOOR_NOT_FOUND",
      () =>
        createFloorMap(
          "floor-1",
          { scenarioId: "scenario-a", drawingPageId: "page-1", name: "X" },
          "tester",
          repository({ getFloor: vi.fn().mockResolvedValue(null) }),
        ),
    ],
    [
      "SCENARIO_NOT_FOUND",
      () =>
        createPlacement(
          placement,
          "tester",
          repository({ getScenario: vi.fn().mockResolvedValue(null) }),
        ),
    ],
    [
      "FLOOR_MAP_NOT_FOUND",
      () =>
        updateFloorMap(
          "missing",
          { scenarioId: "scenario-a", opacity: 1 },
          "tester",
          repository({ getMap: vi.fn().mockResolvedValue(null) }),
        ),
    ],
    [
      "FLOOR_MAP_NOT_FOUND",
      () =>
        updateFloorMap(
          "map-1",
          { scenarioId: "other", opacity: 1 },
          "tester",
          repository({
            getScenario: vi
              .fn()
              .mockResolvedValue({ id: "other", isLocked: false }),
          }),
        ),
    ],
    [
      "FLOOR_MAP_NOT_FOUND",
      () =>
        deleteFloorMap(
          "missing",
          "scenario-a",
          "tester",
          repository({ getMap: vi.fn().mockResolvedValue(null) }),
        ),
    ],
    [
      "FLOOR_MAP_NOT_FOUND",
      () =>
        deleteFloorMap(
          "map-1",
          "scenario-a",
          "tester",
          repository({ deleteMap: vi.fn().mockResolvedValue(false) }),
        ),
    ],
    [
      "INVALID_CALIBRATION",
      () =>
        calibrateFloorMap(
          "map-1",
          { scenarioId: "scenario-a" },
          "tester",
          repository(),
        ),
    ],
    [
      "FLOOR_MAP_NOT_FOUND",
      () =>
        calibrateFloorMap(
          "missing",
          {
            scenarioId: "scenario-a",
            pointA: { x: 0, y: 0 },
            pointB: { x: 1, y: 0 },
            realDistanceMeters: 1,
            createdBy: "tester",
          },
          "tester",
          repository({ getMap: vi.fn().mockResolvedValue(null) }),
        ),
    ],
    [
      "PLACEMENT_NOT_FOUND",
      () =>
        updatePlacement(
          "scenario-a",
          "missing",
          placement,
          "tester",
          repository({ getPlacement: vi.fn().mockResolvedValue(null) }),
        ),
    ],
    [
      "PLACEMENT_NOT_FOUND",
      () =>
        deletePlacement(
          "scenario-a",
          "missing",
          "tester",
          repository({ deletePlacement: vi.fn().mockResolvedValue(false) }),
        ),
    ],
  ])("returns domain error %s", async (code, operation) => {
    await expect(operation()).rejects.toMatchObject({ code });
  });
});
