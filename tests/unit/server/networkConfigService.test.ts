import { describe, expect, it, vi } from "vitest";

import type { NetworkConfigRepository } from "@/server/repositories/networkConfigRepository";
import {
  createLag,
  createMembership,
  createSubnet,
  createVlan,
  deleteVlan,
  updateVlan,
} from "@/server/services/networkConfigService";

function repository(overrides: Partial<NetworkConfigRepository> = {}) {
  return {
    getScenario: vi
      .fn()
      .mockResolvedValue({ id: "scenario-a", isLocked: false }),
    listScenario: vi.fn(),
    getLag: vi.fn(),
    createLag: vi.fn().mockResolvedValue({ id: "lag-1" }),
    updateLag: vi.fn(),
    deleteLag: vi.fn(),
    getPorts: vi.fn().mockResolvedValue([
      {
        id: "port-1",
        deviceInstanceId: "device-1",
        supportedSpeedsMbps: [1000, 10000],
      },
      {
        id: "port-2",
        deviceInstanceId: "device-1",
        supportedSpeedsMbps: [10000],
      },
    ]),
    getDeviceContext: vi
      .fn()
      .mockResolvedValue({
        id: "device-1",
        supportsLacp: true,
        maxLagGroups: 4,
        maxLagMembers: 8,
        lagCount: 0,
      }),
    getVlan: vi.fn().mockResolvedValue({ id: "vlan-1" }),
    createVlan: vi.fn().mockResolvedValue({ id: "vlan-1" }),
    updateVlan: vi.fn().mockResolvedValue({ id: "vlan-1" }),
    deleteVlan: vi.fn().mockResolvedValue(true),
    getSubnet: vi.fn(),
    listSubnets: vi.fn().mockResolvedValue([]),
    createSubnet: vi.fn().mockResolvedValue({ id: "subnet-1" }),
    updateSubnet: vi.fn(),
    deleteSubnet: vi.fn(),
    getMembership: vi.fn(),
    createMembership: vi.fn().mockResolvedValue({ id: "membership-1" }),
    updateMembership: vi.fn(),
    deleteMembership: vi.fn(),
    validateMembershipRefs: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as NetworkConfigRepository;
}

describe("networkConfigService CRUD", () => {
  it("runs VLAN create, update and delete through scenario-scoped repository methods", async () => {
    const repo = repository();
    await createVlan(
      { scenarioId: "scenario-a", vlanId: 10, name: "Users" },
      "tester",
      repo,
    );
    await updateVlan(
      "scenario-a",
      "vlan-1",
      { vlanId: 20, name: "Staff" },
      "tester",
      repo,
    );
    await deleteVlan("scenario-a", "vlan-1", "tester", repo);
    expect(repo.createVlan).toHaveBeenCalledWith(
      expect.objectContaining({ vlanId: 10 }),
      "tester",
    );
    expect(repo.updateVlan).toHaveBeenCalledWith(
      "vlan-1",
      "scenario-a",
      expect.objectContaining({ vlanId: 20 }),
      "tester",
    );
    expect(repo.deleteVlan).toHaveBeenCalledWith(
      "vlan-1",
      "scenario-a",
      "tester",
    );
  });

  it("canonicalizes subnets and rejects overlap in the same VRF", async () => {
    const repo = repository();
    await createSubnet(
      {
        scenarioId: "scenario-a",
        name: "Users",
        cidr: "10.0.0.44/24",
        gateway: "10.0.0.1",
      },
      "tester",
      repo,
    );
    expect(repo.createSubnet).toHaveBeenCalledWith(
      expect.objectContaining({ cidr: "10.0.0.0/24" }),
      "tester",
    );
    await expect(
      createSubnet(
        { scenarioId: "scenario-a", name: "Overlap", cidr: "10.0.0.128/25" },
        "tester",
        repository({
          listSubnets: vi
            .fn()
            .mockResolvedValue([{ id: "s1", cidr: "10.0.0.0/24", vrf: null }]),
        }),
      ),
    ).rejects.toMatchObject({ code: "SUBNET_OVERLAP" });
  });

  it("validates LAG member capabilities and access VLAN semantics", async () => {
    const repo = repository();
    await createLag(
      {
        scenarioId: "scenario-a",
        deviceInstanceId: "device-1",
        name: "Po1",
        memberPortIds: ["port-1", "port-2"],
      },
      "tester",
      repo,
    );
    expect(repo.createLag).toHaveBeenCalled();
    await expect(
      createMembership(
        {
          scenarioId: "scenario-a",
          portId: "port-1",
          mode: "ACCESS",
          nativeVlanId: "vlan-1",
          allowedVlanIds: [],
        },
        "tester",
        repo,
      ),
    ).rejects.toMatchObject({ code: "INVALID_ACCESS_VLANS" });
  });

  it("blocks every mutation when the scenario is locked", async () => {
    await expect(
      createVlan(
        { scenarioId: "scenario-a", vlanId: 10, name: "Users" },
        "tester",
        repository({
          getScenario: vi
            .fn()
            .mockResolvedValue({ id: "scenario-a", isLocked: true }),
        }),
      ),
    ).rejects.toMatchObject({ code: "SCENARIO_LOCKED" });
  });
});
