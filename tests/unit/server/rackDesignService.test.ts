import { describe, expect, it, vi } from "vitest";

import type { RackDesignRepository } from "@/server/repositories/rackDesignRepository";
import { getRackRoomDesign, placeDeviceInRack } from "@/server/services/rackDesignService";

function repository(overrides: Partial<RackDesignRepository> = {}) {
  return {
    getScenario: vi.fn().mockResolvedValue({ id: "scenario-1", name: "Proposed", isLocked: false }),
    getB2Room: vi.fn().mockResolvedValue({ buildings: [], unplacedDevices: [] }),
    getPlacementContext: vi.fn().mockResolvedValue({
      scenario: { isLocked: false },
      device: { id: "device-1", floorId: "floor-b2", model: { rackUnits: 2 } },
      rack: { id: "rack-1", zoneId: "zone-b2", rackUnits: 42, zone: { floorId: "floor-b2" } },
      occupants: [],
    }),
    savePlacement: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as RackDesignRepository;
}

describe("rackDesignService", () => {
  it("returns the B2 rack-room read model for a scenario", async () => {
    const repo = repository();
    const result = await getRackRoomDesign("scenario-1", repo);
    expect(result.scenario.name).toBe("Proposed");
    expect(repo.getB2Room).toHaveBeenCalledWith("scenario-1");
  });

  it("places a multi-U device and persists its rack hierarchy", async () => {
    const repo = repository();
    await expect(placeDeviceInRack("scenario-1", "device-1", {
      action: "place", rackId: "rack-1", rackUnitStart: 10,
    }, repo)).resolves.toEqual({ deviceId: "device-1", rackId: "rack-1", rackUnitStart: 10 });
    expect(repo.savePlacement).toHaveBeenCalledWith("scenario-1", "device-1", "rack-1", "zone-b2", 10);
  });

  it("rejects a placement that exceeds rack capacity", async () => {
    const repo = repository();
    await expect(placeDeviceInRack("scenario-1", "device-1", {
      action: "place", rackId: "rack-1", rackUnitStart: 42,
    }, repo)).rejects.toMatchObject({ code: "RACK_CAPACITY_EXCEEDED", status: 409 });
  });

  it("rejects overlapping occupied rack units", async () => {
    const repo = repository({
      getPlacementContext: vi.fn().mockResolvedValue({
        scenario: { isLocked: false },
        device: { id: "device-1", floorId: "floor-b2", model: { rackUnits: 2 } },
        rack: { id: "rack-1", zoneId: "zone-b2", rackUnits: 42, zone: { floorId: "floor-b2" } },
        occupants: [{ id: "device-2", hostname: "CORE-02", rackUnitStart: 11, model: { rackUnits: 1 } }],
      }),
    });
    await expect(placeDeviceInRack("scenario-1", "device-1", {
      action: "place", rackId: "rack-1", rackUnitStart: 10,
    }, repo)).rejects.toMatchObject({ code: "RACK_UNIT_OCCUPIED", status: 409 });
  });

  it("prevents edits to locked scenarios", async () => {
    const repo = repository({
      getPlacementContext: vi.fn().mockResolvedValue({ scenario: { isLocked: true }, device: null, rack: null, occupants: [] }),
    });
    await expect(placeDeviceInRack("scenario-1", "device-1", {
      action: "place", rackId: "rack-1", rackUnitStart: 1,
    }, repo)).rejects.toMatchObject({ code: "SCENARIO_LOCKED", status: 409 });
  });

  it("removes a device from its rack", async () => {
    const repo = repository();
    await placeDeviceInRack("scenario-1", "device-1", { action: "remove" }, repo);
    expect(repo.savePlacement).toHaveBeenCalledWith("scenario-1", "device-1", null, null, null);
  });
});
