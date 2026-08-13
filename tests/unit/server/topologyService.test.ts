import { describe, expect, it, vi } from "vitest";

import type {
  TopologyLinkRecord,
  TopologyRepository,
} from "@/server/repositories/topologyRepository";
import {
  createPhysicalLink,
  deletePhysicalLink,
  getTopology,
  updateTopologyPositions,
} from "@/server/services/topologyService";

function link() {
  return {
    id: "link-1",
    scenarioId: "scenario-a",
    sourcePortId: "port-a",
    targetPortId: "port-b",
    sourcePort: { deviceInstanceId: "device-a" },
    targetPort: { deviceInstanceId: "device-b" },
    linkType: "FIBER",
    speedMbps: 10000,
    duplex: "FULL",
    status: "PLANNED",
    cableLabel: null,
    lengthMeters: null,
  } as unknown as TopologyLinkRecord;
}

function repository(overrides: Partial<TopologyRepository> = {}) {
  return {
    getTopology: vi.fn().mockResolvedValue({
      scenario: { id: "scenario-a", name: "Baseline", isLocked: false },
      devices: [],
      links: [],
    }),
    getScenario: vi.fn().mockResolvedValue({
      id: "scenario-a",
      isLocked: false,
    }),
    getPorts: vi.fn().mockResolvedValue([
      {
        id: "port-a",
        deviceInstanceId: "device-a",
        supportedSpeedsMbps: [1000, 10000],
        media: "SFP_PLUS",
      },
      {
        id: "port-b",
        deviceInstanceId: "device-b",
        supportedSpeedsMbps: [10000],
        media: "SFP_PLUS",
      },
    ]),
    findPortConflict: vi.fn().mockResolvedValue(null),
    findLink: vi.fn().mockResolvedValue(link()),
    createLink: vi.fn().mockResolvedValue(link()),
    updateLink: vi.fn().mockResolvedValue(link()),
    deleteLink: vi.fn().mockResolvedValue(undefined),
    updatePositions: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as TopologyRepository;
}

const validLink = {
  scenarioId: "scenario-a",
  sourcePortId: "port-a",
  targetPortId: "port-b",
  linkType: "FIBER",
  speedMbps: 10000,
};

describe("topologyService", () => {
  it("returns a scenario-scoped topology read model", async () => {
    const repo = repository();
    await getTopology("scenario-a", repo);
    expect(repo.getTopology).toHaveBeenCalledWith("scenario-a");
    await expect(getTopology("", repo)).rejects.toMatchObject({
      code: "SCENARIO_REQUIRED",
    });
  });

  it("creates a port-first link with defaults and actor audit context", async () => {
    const repo = repository();
    const result = await createPhysicalLink(validLink, "tester", repo);
    expect(repo.createLink).toHaveBeenCalledWith(
      expect.objectContaining({ duplex: "FULL", status: "PLANNED" }),
      "tester",
    );
    expect(result).toMatchObject({
      sourceDeviceId: "device-a",
      targetDeviceId: "device-b",
    });
  });

  it.each([
    [
      "locked scenario",
      {
        getScenario: vi
          .fn()
          .mockResolvedValue({ id: "scenario-a", isLocked: true }),
      },
      "SCENARIO_LOCKED",
    ],
    [
      "cross-scenario or missing port",
      { getPorts: vi.fn().mockResolvedValue([]) },
      "PORT_NOT_FOUND",
    ],
    [
      "occupied port",
      { findPortConflict: vi.fn().mockResolvedValue({ id: "other-link" }) },
      "PORT_ALREADY_CONNECTED",
    ],
  ])("rejects %s", async (_label, override, code) => {
    await expect(
      createPhysicalLink(validLink, "tester", repository(override)),
    ).rejects.toMatchObject({ code });
  });

  it("rejects same-device and unsupported-speed connections", async () => {
    await expect(
      createPhysicalLink(
        validLink,
        "tester",
        repository({
          getPorts: vi.fn().mockResolvedValue([
            {
              id: "port-a",
              deviceInstanceId: "device-a",
              supportedSpeedsMbps: [10000],
              media: "SFP_PLUS",
            },
            {
              id: "port-b",
              deviceInstanceId: "device-a",
              supportedSpeedsMbps: [10000],
              media: "SFP_PLUS",
            },
          ]),
        }),
      ),
    ).rejects.toMatchObject({ code: "SAME_DEVICE_LINK" });

    await expect(
      createPhysicalLink(
        validLink,
        "tester",
        repository({
          getPorts: vi.fn().mockResolvedValue([
            {
              id: "port-a",
              deviceInstanceId: "device-a",
              supportedSpeedsMbps: [1000],
              media: "SFP",
            },
            {
              id: "port-b",
              deviceInstanceId: "device-b",
              supportedSpeedsMbps: [1000],
              media: "SFP",
            },
          ]),
        }),
      ),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_LINK_SPEED" });
  });

  it("persists node positions and deletes only inside a mutable scenario", async () => {
    const repo = repository();
    await updateTopologyPositions(
      "scenario-a",
      { positions: [{ id: "device-a", graphX: 10, graphY: 20 }] },
      "tester",
      repo,
    );
    expect(repo.updatePositions).toHaveBeenCalledWith(
      "scenario-a",
      [{ id: "device-a", graphX: 10, graphY: 20 }],
      "tester",
    );
    await deletePhysicalLink("scenario-a", "link-1", "tester", repo);
    expect(repo.deleteLink).toHaveBeenCalledWith(
      "scenario-a",
      "link-1",
      "tester",
      expect.objectContaining({ id: "link-1" }),
    );
  });
});
