import { describe, expect, it, vi } from "vitest";

import type { NetworkConfigRepository } from "@/server/repositories/networkConfigRepository";
import {
  createLag,
  createMembership,
  createSubnet,
  createVlan,
  deleteLag,
  deleteMembership,
  deleteSubnet,
  deleteVlan,
  getNetworkConfig,
  updateLag,
  updateMembership,
  updateSubnet,
  updateVlan,
} from "@/server/services/networkConfigService";

function repository(overrides: Partial<NetworkConfigRepository> = {}) {
  return {
    getScenario: vi
      .fn()
      .mockResolvedValue({ id: "scenario-a", isLocked: false }),
    listScenario: vi.fn().mockResolvedValue({
      scenario: { id: "scenario-a", isLocked: false },
    }),
    getLag: vi.fn().mockResolvedValue({ id: "lag-1" }),
    createLag: vi.fn().mockResolvedValue({ id: "lag-1" }),
    updateLag: vi.fn().mockResolvedValue({ id: "lag-1" }),
    deleteLag: vi.fn().mockResolvedValue(true),
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
    getDeviceContext: vi.fn().mockResolvedValue({
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
    getSubnet: vi.fn().mockResolvedValue({ id: "subnet-1" }),
    listSubnets: vi.fn().mockResolvedValue([]),
    createSubnet: vi.fn().mockResolvedValue({ id: "subnet-1" }),
    updateSubnet: vi.fn().mockResolvedValue({ id: "subnet-1" }),
    deleteSubnet: vi.fn().mockResolvedValue(true),
    getMembership: vi.fn().mockResolvedValue({ id: "membership-1" }),
    createMembership: vi.fn().mockResolvedValue({ id: "membership-1" }),
    updateMembership: vi.fn().mockResolvedValue({ id: "membership-1" }),
    deleteMembership: vi.fn().mockResolvedValue(true),
    validateMembershipRefs: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as NetworkConfigRepository;
}

describe("networkConfigService CRUD", () => {
  const lagInput = {
    scenarioId: "scenario-a",
    deviceInstanceId: "device-1",
    name: "Po1",
    memberPortIds: ["port-1", "port-2"],
  };

  const membershipInput = {
    scenarioId: "scenario-a",
    portId: "port-1",
    mode: "ACCESS",
    nativeVlanId: "vlan-1",
    allowedVlanIds: ["vlan-1"],
  };

  it("reads only an existing scenario", async () => {
    const repo = repository();
    await expect(getNetworkConfig("scenario-a", repo)).resolves.toMatchObject({
      scenario: { id: "scenario-a" },
    });
    await expect(getNetworkConfig("", repo)).rejects.toMatchObject({
      code: "SCENARIO_REQUIRED",
    });
    await expect(
      getNetworkConfig(
        "missing",
        repository({
          listScenario: vi.fn().mockResolvedValue({ scenario: null }),
        }),
      ),
    ).rejects.toMatchObject({ code: "SCENARIO_NOT_FOUND" });
  });

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

  it("updates and deletes all scenario-scoped resources", async () => {
    const repo = repository();
    await updateLag("scenario-a", "lag-1", lagInput, "tester", repo);
    await updateSubnet(
      "scenario-a",
      "subnet-1",
      { name: "Staff", cidr: "10.2.0.9/24", dnsServers: [] },
      "tester",
      repo,
    );
    await createMembership(membershipInput, "tester", repo);
    await updateMembership(
      "scenario-a",
      "membership-1",
      membershipInput,
      "tester",
      repo,
    );
    await deleteLag("scenario-a", "lag-1", "tester", repo);
    await deleteSubnet("scenario-a", "subnet-1", "tester", repo);
    await deleteMembership("scenario-a", "membership-1", "tester", repo);
    expect(repo.updateLag).toHaveBeenCalledWith(
      "lag-1",
      "scenario-a",
      expect.objectContaining({ name: "Po1" }),
      ["port-1", "port-2"],
      "tester",
    );
    expect(repo.updateSubnet).toHaveBeenCalledWith(
      "subnet-1",
      "scenario-a",
      expect.objectContaining({ cidr: "10.2.0.0/24" }),
      "tester",
    );
    expect(repo.updateMembership).toHaveBeenCalled();
  });

  it.each([
    ["DUPLICATE_LAG_MEMBER", { memberPortIds: ["port-1", "port-1"] }, {}],
    ["INVALID_MIN_LINKS", { minLinks: 3 }, {}],
    ["INVALID_SPEED_POLICY", { logicalSpeedPolicy: "MANUAL" }, {}],
    ["INVALID_SPEED_POLICY", { manualSpeedMbps: 1000 }, {}],
    [
      "DEVICE_NOT_FOUND",
      {},
      { getDeviceContext: vi.fn().mockResolvedValue(null) },
    ],
    [
      "LACP_UNSUPPORTED",
      {},
      {
        getDeviceContext: vi
          .fn()
          .mockResolvedValue({
            id: "device-1",
            supportsLacp: false,
            maxLagGroups: null,
            maxLagMembers: null,
            lagCount: 0,
          }),
      },
    ],
    [
      "LAG_CAPACITY_EXCEEDED",
      {},
      {
        getDeviceContext: vi
          .fn()
          .mockResolvedValue({
            id: "device-1",
            supportsLacp: true,
            maxLagGroups: 1,
            maxLagMembers: null,
            lagCount: 1,
          }),
      },
    ],
    [
      "LAG_MEMBER_LIMIT",
      {},
      {
        getDeviceContext: vi
          .fn()
          .mockResolvedValue({
            id: "device-1",
            supportsLacp: true,
            maxLagGroups: null,
            maxLagMembers: 1,
            lagCount: 0,
          }),
      },
    ],
    ["INVALID_LAG_PORTS", {}, { getPorts: vi.fn().mockResolvedValue([]) }],
    [
      "INVALID_LAG_PORTS",
      {},
      {
        getPorts: vi.fn().mockResolvedValue([
          {
            id: "port-1",
            deviceInstanceId: "other",
            supportedSpeedsMbps: [10000],
          },
          {
            id: "port-2",
            deviceInstanceId: "device-1",
            supportedSpeedsMbps: [10000],
          },
        ]),
      },
    ],
    [
      "INCOMPATIBLE_LAG_SPEEDS",
      {},
      {
        getPorts: vi.fn().mockResolvedValue([
          {
            id: "port-1",
            deviceInstanceId: "device-1",
            supportedSpeedsMbps: [1000],
          },
          {
            id: "port-2",
            deviceInstanceId: "device-1",
            supportedSpeedsMbps: [10000],
          },
        ]),
      },
    ],
  ])("rejects LAG rule %s", async (code, input, overrides) => {
    await expect(
      createLag({ ...lagInput, ...input }, "tester", repository(overrides)),
    ).rejects.toMatchObject({ code });
  });

  it.each([
    ["INVALID_CIDR", { cidr: "10.0.0.0/99" }, {}],
    ["INVALID_IPV4", { dnsServers: ["999.1.1.1"] }, {}],
    ["IP_OUTSIDE_SUBNET", { gateway: "10.1.0.1" }, {}],
    [
      "INVALID_DHCP_RANGE",
      { dhcpStart: "10.0.0.20", dhcpEnd: "10.0.0.10" },
      {},
    ],
    [
      "VLAN_NOT_FOUND",
      { vlanId: "missing" },
      { getVlan: vi.fn().mockResolvedValue(null) },
    ],
  ])("rejects subnet rule %s", async (code, input, overrides) => {
    await expect(
      createSubnet(
        {
          scenarioId: "scenario-a",
          name: "Users",
          cidr: "10.0.0.0/24",
          ...input,
        },
        "tester",
        repository(overrides),
      ),
    ).rejects.toMatchObject({ code });
  });

  it("allows the same CIDR in another VRF and ignores malformed legacy peers", async () => {
    const repo = repository({
      listSubnets: vi.fn().mockResolvedValue([
        { id: "bad", cidr: "bad", vrf: null },
        { id: "other", cidr: "10.0.0.0/24", vrf: "OTHER" },
      ]),
    });
    await createSubnet(
      { scenarioId: "scenario-a", name: "Users", cidr: "10.0.0.0/24" },
      "tester",
      repo,
    );
    expect(repo.createSubnet).toHaveBeenCalled();
  });

  it.each([
    ["INVALID_INTERFACE", { portId: null, lagGroupId: null }],
    ["INVALID_INTERFACE", { lagGroupId: "lag-1" }],
    ["ACCESS_VLAN_REQUIRED", { nativeVlanId: null, allowedVlanIds: [] }],
    ["INVALID_ACCESS_VLANS", { allowedVlanIds: ["vlan-1", "vlan-2"] }],
    [
      "ALLOWED_VLAN_REQUIRED",
      { mode: "TRUNK", nativeVlanId: null, allowedVlanIds: [] },
    ],
  ])("rejects membership rule %s", async (code, input) => {
    await expect(
      createMembership(
        { ...membershipInput, ...input },
        "tester",
        repository(),
      ),
    ).rejects.toMatchObject({ code });
  });

  it("rejects cross-scenario membership references and deduplicates allowed VLANs", async () => {
    await expect(
      createMembership(
        membershipInput,
        "tester",
        repository({
          validateMembershipRefs: vi.fn().mockResolvedValue(false),
        }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_MEMBERSHIP_REFS" });
    const repo = repository();
    await createMembership(
      {
        ...membershipInput,
        mode: "TRUNK",
        nativeVlanId: null,
        allowedVlanIds: ["vlan-1", "vlan-1"],
      },
      "tester",
      repo,
    );
    expect(repo.createMembership).toHaveBeenCalledWith(
      expect.anything(),
      ["vlan-1"],
      "tester",
    );
  });

  it.each([
    [
      "LAG_NOT_FOUND",
      () =>
        updateLag(
          "scenario-a",
          "missing",
          lagInput,
          "tester",
          repository({ getLag: vi.fn().mockResolvedValue(null) }),
        ),
    ],
    [
      "LAG_NOT_FOUND",
      () =>
        deleteLag(
          "scenario-a",
          "missing",
          "tester",
          repository({ deleteLag: vi.fn().mockResolvedValue(false) }),
        ),
    ],
    [
      "VLAN_NOT_FOUND",
      () =>
        updateVlan(
          "scenario-a",
          "missing",
          { vlanId: 10, name: "X" },
          "tester",
          repository({ getVlan: vi.fn().mockResolvedValue(null) }),
        ),
    ],
    [
      "VLAN_NOT_FOUND",
      () =>
        deleteVlan(
          "scenario-a",
          "missing",
          "tester",
          repository({ deleteVlan: vi.fn().mockResolvedValue(false) }),
        ),
    ],
    [
      "SUBNET_NOT_FOUND",
      () =>
        updateSubnet(
          "scenario-a",
          "missing",
          { name: "X", cidr: "10.0.0.0/24" },
          "tester",
          repository({ getSubnet: vi.fn().mockResolvedValue(null) }),
        ),
    ],
    [
      "SUBNET_NOT_FOUND",
      () =>
        deleteSubnet(
          "scenario-a",
          "missing",
          "tester",
          repository({ deleteSubnet: vi.fn().mockResolvedValue(false) }),
        ),
    ],
    [
      "MEMBERSHIP_NOT_FOUND",
      () =>
        updateMembership(
          "scenario-a",
          "missing",
          membershipInput,
          "tester",
          repository({ getMembership: vi.fn().mockResolvedValue(null) }),
        ),
    ],
    [
      "MEMBERSHIP_NOT_FOUND",
      () =>
        deleteMembership(
          "scenario-a",
          "missing",
          "tester",
          repository({ deleteMembership: vi.fn().mockResolvedValue(false) }),
        ),
    ],
  ])(
    "returns %s for missing update/delete records",
    async (code, operation) => {
      await expect(operation()).rejects.toMatchObject({ code });
    },
  );

  it("rejects invalid schemas and a missing scenario", async () => {
    await expect(createVlan({}, "tester", repository())).rejects.toMatchObject({
      code: "INVALID_VLAN",
    });
    await expect(
      createVlan(
        { scenarioId: "scenario-a", vlanId: 10, name: "Users" },
        "tester",
        repository({ getScenario: vi.fn().mockResolvedValue(null) }),
      ),
    ).rejects.toMatchObject({ code: "SCENARIO_NOT_FOUND" });
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
