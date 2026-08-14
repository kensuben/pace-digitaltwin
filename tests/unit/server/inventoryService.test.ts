import { describe, expect, it, vi } from "vitest";

import type {
  InventoryDetailRecord,
  InventoryRepository,
} from "@/server/repositories/inventoryRepository";
import {
  createInventoryDevice,
  deleteInventoryDevice,
  getInventoryDevice,
  getInventoryOptions,
  listInventory,
  parseInventoryFilters,
  updateInventoryDevice,
} from "@/server/services/inventoryService";

function device(locked = false) {
  return {
    id: "device-1",
    scenarioId: "scenario-a",
    hostname: "DEVICE-1",
    displayName: "Device 1",
    modelId: "model-1",
    buildingId: "building-1",
    floorId: "floor-1",
    status: "PLANNED",
    scenario: { id: "scenario-a", isLocked: locked },
    ports: [],
  } as unknown as InventoryDetailRecord;
}

function repository(overrides: Partial<InventoryRepository> = {}) {
  return {
    list: vi.fn().mockResolvedValue([]),
    findByIdInScenario: vi.fn().mockResolvedValue(device()),
    getCreationContext: vi.fn().mockResolvedValue({
      scenario: { id: "scenario-a", isLocked: false },
      profiles: [
        {
          portGroup: "DEFAULT",
          count: 2,
          media: "RJ45",
          supportedSpeedsMbps: [1000],
          poeStandard: "NONE",
          roleHint: "DATA",
          breakoutCapable: false,
          namePrefix: "port",
          startNumber: 1,
          sortOrder: 1,
        },
      ],
      locationValid: true,
    }),
    createWithPorts: vi.fn().mockResolvedValue(device()),
    updateInScenario: vi.fn().mockResolvedValue(device()),
    deleteInScenario: vi.fn().mockResolvedValue(true),
    listOptions: vi.fn().mockResolvedValue({
      scenarios: [],
      models: [],
      vendors: [],
      buildings: [],
    }),
    ...overrides,
  } as InventoryRepository;
}

const validInput = {
  scenarioId: "scenario-a",
  hostname: " access-t1-01 ",
  displayName: "Access T1",
  modelId: "model-1",
  buildingId: "building-1",
  floorId: "floor-1",
};

describe("inventoryService", () => {
  it("requires scenario context and prevents cross-scenario reads", async () => {
    await expect(
      getInventoryDevice("", "device-1", repository()),
    ).rejects.toMatchObject({
      code: "SCENARIO_REQUIRED",
    });
    const repo = repository({
      findByIdInScenario: vi.fn().mockResolvedValue(null),
    });
    await expect(
      getInventoryDevice("scenario-b", "device-1", repo),
    ).rejects.toMatchObject({
      code: "DEVICE_NOT_FOUND",
    });
    expect(repo.findByIdInScenario).toHaveBeenCalledWith(
      "device-1",
      "scenario-b",
    );
  });

  it("creates ports from the selected model profile", async () => {
    const repo = repository();
    await createInventoryDevice(validInput, repo);
    expect(repo.createWithPorts).toHaveBeenCalledWith(
      expect.objectContaining({ hostname: "ACCESS-T1-01" }),
      [
        expect.objectContaining({ name: "port1", index: 1 }),
        expect.objectContaining({ name: "port2", index: 2 }),
      ],
    );
  });

  it.each([
    ["missing scenario", { scenario: null }, "SCENARIO_NOT_FOUND"],
    [
      "locked scenario",
      { scenario: { id: "scenario-a", isLocked: true } },
      "SCENARIO_LOCKED",
    ],
    ["missing model", { profiles: null }, "MODEL_NOT_FOUND"],
    ["invalid location", { locationValid: false }, "INVALID_LOCATION"],
  ])("rejects %s during creation", async (_label, contextOverride, code) => {
    const baseContext = await repository().getCreationContext(validInput);
    const repo = repository({
      getCreationContext: vi
        .fn()
        .mockResolvedValue({ ...baseContext, ...contextOverride }),
    });
    await expect(createInventoryDevice(validInput, repo)).rejects.toMatchObject(
      { code },
    );
  });

  it("rejects invalid device input before repository access", async () => {
    await expect(
      createInventoryDevice(
        { ...validInput, hostname: "bad host" },
        repository(),
      ),
    ).rejects.toMatchObject({
      code: "INVALID_DEVICE",
    });
  });

  it("blocks updates and deletes in locked scenarios", async () => {
    const repo = repository({
      findByIdInScenario: vi.fn().mockResolvedValue(device(true)),
    });
    await expect(
      updateInventoryDevice(
        "scenario-a",
        "device-1",
        { status: "ACTIVE" },
        repo,
      ),
    ).rejects.toMatchObject({
      code: "SCENARIO_LOCKED",
    });
    await expect(
      deleteInventoryDevice("scenario-a", "device-1", repo),
    ).rejects.toMatchObject({
      code: "SCENARIO_LOCKED",
    });
  });

  it("allows identity-only edits on a locked baseline", async () => {
    const repo = repository({
      findByIdInScenario: vi.fn().mockResolvedValue(device(true)),
      findHostnameConflict: vi.fn().mockResolvedValue(false),
    });
    await updateInventoryDevice(
      "scenario-a",
      "device-1",
      { hostname: "core-baseline", displayName: "Core Baseline" },
      repo,
    );
    expect(repo.updateInScenario).toHaveBeenCalledWith(
      "device-1",
      "scenario-a",
      { hostname: "CORE-BASELINE", displayName: "Core Baseline" },
    );
  });

  it("updates and deletes only through the scenario-scoped repository methods", async () => {
    const repo = repository();
    await updateInventoryDevice(
      "scenario-a",
      "device-1",
      { status: "ACTIVE" },
      repo,
    );
    expect(repo.updateInScenario).toHaveBeenCalledWith(
      "device-1",
      "scenario-a",
      { status: "ACTIVE" },
    );
    await deleteInventoryDevice("scenario-a", "device-1", repo);
    expect(repo.deleteInScenario).toHaveBeenCalledWith(
      "device-1",
      "scenario-a",
    );

    await expect(
      updateInventoryDevice("scenario-a", "device-1", {}, repository()),
    ).rejects.toMatchObject({ code: "INVALID_DEVICE" });
    await expect(
      updateInventoryDevice(
        "scenario-a",
        "device-1",
        { status: "ACTIVE" },
        repository({ updateInScenario: vi.fn().mockResolvedValue(null) }),
      ),
    ).rejects.toMatchObject({ code: "DEVICE_NOT_FOUND" });
    await expect(
      deleteInventoryDevice(
        "scenario-a",
        "device-1",
        repository({ deleteInScenario: vi.fn().mockResolvedValue(false) }),
      ),
    ).rejects.toMatchObject({ code: "DEVICE_NOT_FOUND" });
  });

  it("validates the complete hierarchy before changing device location", async () => {
    const repo = repository();
    await updateInventoryDevice(
      "scenario-a",
      "device-1",
      {
        buildingId: "building-1",
        floorId: "floor-2",
        zoneId: "zone-2",
        rackId: "rack-2",
        rackUnitStart: 12,
      },
      repo,
    );
    expect(repo.getCreationContext).toHaveBeenCalledWith(
      expect.objectContaining({
        scenarioId: "scenario-a",
        modelId: "model-1",
        buildingId: "building-1",
        floorId: "floor-2",
        zoneId: "zone-2",
        rackId: "rack-2",
      }),
    );
    expect(repo.updateInScenario).toHaveBeenCalledWith(
      "device-1",
      "scenario-a",
      expect.objectContaining({ floorId: "floor-2", rackUnitStart: 12 }),
    );

    const invalidRepo = repository({
      getCreationContext: vi
        .fn()
        .mockResolvedValue({
          scenario: { id: "scenario-a", isLocked: false },
          profiles: [],
          locationValid: false,
        }),
    });
    await expect(
      updateInventoryDevice(
        "scenario-a",
        "device-1",
        { buildingId: "building-1", floorId: "floor-x" },
        invalidRepo,
      ),
    ).rejects.toMatchObject({ code: "INVALID_LOCATION" });
  });

  it("normalizes hostname edits and rejects duplicates in the scenario", async () => {
    const repo = repository({
      findHostnameConflict: vi.fn().mockResolvedValue(false),
    });
    await updateInventoryDevice(
      "scenario-a",
      "device-1",
      { hostname: " core-new ", displayName: "Core mới" },
      repo,
    );
    expect(repo.updateInScenario).toHaveBeenCalledWith(
      "device-1",
      "scenario-a",
      { hostname: "CORE-NEW", displayName: "Core mới" },
    );
    const duplicateRepo = repository({
      findHostnameConflict: vi.fn().mockResolvedValue(true),
    });
    await expect(
      updateInventoryDevice(
        "scenario-a",
        "device-1",
        { hostname: "CORE-02" },
        duplicateRepo,
      ),
    ).rejects.toMatchObject({ code: "HOSTNAME_CONFLICT", status: 409 });
  });

  it("normalizes list filters and ignores invalid enum filters", async () => {
    const repo = repository();
    await listInventory({ search: " core " }, repo);
    expect(repo.list).toHaveBeenCalledWith({ search: "core" });
    expect(
      parseInventoryFilters({ category: "INVALID", status: "ACTIVE" }),
    ).toEqual({
      scenarioId: undefined,
      search: undefined,
      category: undefined,
      status: "ACTIVE",
    });

    await expect(getInventoryOptions(repo)).resolves.toEqual({
      scenarios: [],
      models: [],
      vendors: [],
      buildings: [],
    });
  });
});
