import { z } from "zod";

import {
  LagMode,
  LagProtocol,
  LogicalSpeedPolicy,
  VlanMembershipMode,
} from "@/generated/prisma/enums";
import {
  ipv4InNetwork,
  ipv4NetworksOverlap,
  ipv4ToNumber,
  parseIpv4Cidr,
} from "@/domain/network/ipv4";
import { AppError } from "@/server/errors";
import {
  PrismaNetworkConfigRepository,
  type NetworkConfigRepository,
} from "@/server/repositories/networkConfigRepository";

const text = z.string().trim().min(1).max(120);
const optionalText = z.string().trim().max(500).nullish();

const lagSchema = z.object({
  scenarioId: z.string().min(1),
  deviceInstanceId: z.string().min(1),
  name: text,
  protocol: z.enum(LagProtocol).default("LACP"),
  mode: z.enum(LagMode).default("ACTIVE"),
  minLinks: z.number().int().positive().default(1),
  logicalSpeedPolicy: z.enum(LogicalSpeedPolicy).default("SUM_MEMBERS"),
  manualSpeedMbps: z.number().int().positive().nullish(),
  description: optionalText,
  memberPortIds: z.array(z.string().min(1)).min(1),
});

const vlanSchema = z.object({
  scenarioId: z.string().min(1),
  vlanId: z.number().int().min(1).max(4094),
  name: text,
  purpose: optionalText,
  colorKey: z.string().trim().max(40).nullish(),
});

const subnetSchema = z.object({
  scenarioId: z.string().min(1),
  vlanId: z.string().min(1).nullish(),
  name: text,
  cidr: z.string().trim().min(1),
  gateway: z.string().trim().nullish(),
  dhcpStart: z.string().trim().nullish(),
  dhcpEnd: z.string().trim().nullish(),
  dnsServers: z.array(z.string().trim()).default([]),
  vrf: z.string().trim().max(120).nullish(),
  description: optionalText,
});

const membershipSchema = z.object({
  scenarioId: z.string().min(1),
  portId: z.string().min(1).nullish(),
  lagGroupId: z.string().min(1).nullish(),
  mode: z.enum(VlanMembershipMode),
  nativeVlanId: z.string().min(1).nullish(),
  allowedVlanIds: z.array(z.string().min(1)),
  description: optionalText,
});

function invalid(code: string, message: string, status = 400): never {
  throw new AppError(code, message, status);
}

async function assertMutable(
  scenarioId: string,
  repository: NetworkConfigRepository,
) {
  const scenario = await repository.getScenario(scenarioId);
  if (!scenario) invalid("SCENARIO_NOT_FOUND", "Scenario was not found.", 404);
  if (scenario.isLocked)
    invalid("SCENARIO_LOCKED", "Locked scenarios cannot be changed.", 409);
}

function parse<T>(schema: z.ZodType<T>, value: unknown, entity: string): T {
  const result = schema.safeParse(value);
  if (!result.success)
    invalid(
      `INVALID_${entity.toUpperCase()}`,
      result.error.issues[0]?.message ?? `Invalid ${entity}.`,
    );
  return result.data;
}

export async function getNetworkConfig(
  scenarioId: string,
  repository: NetworkConfigRepository = new PrismaNetworkConfigRepository(),
) {
  if (!scenarioId) invalid("SCENARIO_REQUIRED", "scenarioId is required.");
  const result = (await repository.listScenario(scenarioId)) as {
    scenario: unknown;
  };
  if (!result.scenario)
    invalid("SCENARIO_NOT_FOUND", "Scenario was not found.", 404);
  return result;
}

async function validateLag(
  value: z.infer<typeof lagSchema>,
  repository: NetworkConfigRepository,
  updating = false,
) {
  const ids = [...new Set(value.memberPortIds)];
  if (ids.length !== value.memberPortIds.length)
    invalid("DUPLICATE_LAG_MEMBER", "A port can only appear once in a LAG.");
  if (value.minLinks > ids.length)
    invalid("INVALID_MIN_LINKS", "minLinks cannot exceed member count.");
  if (
    (value.logicalSpeedPolicy === "MANUAL") !==
    Boolean(value.manualSpeedMbps)
  )
    invalid(
      "INVALID_SPEED_POLICY",
      "manualSpeedMbps is required only for the MANUAL speed policy.",
    );
  const device = await repository.getDeviceContext(
    value.deviceInstanceId,
    value.scenarioId,
  );
  if (!device) invalid("DEVICE_NOT_FOUND", "Device was not found.", 404);
  if (value.protocol === "LACP" && !device.supportsLacp)
    invalid("LACP_UNSUPPORTED", "The selected device does not support LACP.");
  if (
    !updating &&
    device.maxLagGroups !== null &&
    device.lagCount >= device.maxLagGroups
  )
    invalid(
      "LAG_CAPACITY_EXCEEDED",
      "The device has reached its LAG limit.",
      409,
    );
  if (device.maxLagMembers !== null && ids.length > device.maxLagMembers)
    invalid("LAG_MEMBER_LIMIT", "The LAG exceeds the device member limit.");
  const ports = await repository.getPorts(value.scenarioId, ids);
  if (
    ports.length !== ids.length ||
    ports.some((port) => port.deviceInstanceId !== value.deviceInstanceId)
  )
    invalid(
      "INVALID_LAG_PORTS",
      "All LAG members must be ports on the selected device.",
    );
  const commonSpeeds = ports.reduce<number[]>(
    (common, port) =>
      common.filter((speed) => port.supportedSpeedsMbps.includes(speed)),
    ports[0]?.supportedSpeedsMbps ?? [],
  );
  if (!commonSpeeds.length)
    invalid("INCOMPATIBLE_LAG_SPEEDS", "LAG members need a common speed.");
}

export async function createLag(
  input: unknown,
  actor = "local-admin",
  repository: NetworkConfigRepository = new PrismaNetworkConfigRepository(),
) {
  const value = parse(lagSchema, input, "lag");
  await assertMutable(value.scenarioId, repository);
  await validateLag(value, repository);
  const { memberPortIds, ...data } = value;
  return repository.createLag(data, memberPortIds, actor);
}

export async function updateLag(
  scenarioId: string,
  id: string,
  input: unknown,
  actor = "local-admin",
  repository: NetworkConfigRepository = new PrismaNetworkConfigRepository(),
) {
  const value = parse(lagSchema, { ...(input as object), scenarioId }, "lag");
  await assertMutable(scenarioId, repository);
  if (!(await repository.getLag(id, scenarioId)))
    invalid("LAG_NOT_FOUND", "LAG was not found.", 404);
  await validateLag(value, repository, true);
  const { memberPortIds, scenarioId: scenarioIdFromBody, ...data } = value;
  void scenarioIdFromBody;
  return repository.updateLag(id, scenarioId, data, memberPortIds, actor);
}

export async function deleteLag(
  scenarioId: string,
  id: string,
  actor = "local-admin",
  repository: NetworkConfigRepository = new PrismaNetworkConfigRepository(),
) {
  await assertMutable(scenarioId, repository);
  if (!(await repository.deleteLag(id, scenarioId, actor)))
    invalid("LAG_NOT_FOUND", "LAG was not found.", 404);
}

export async function createVlan(
  input: unknown,
  actor = "local-admin",
  repository: NetworkConfigRepository = new PrismaNetworkConfigRepository(),
) {
  const value = parse(vlanSchema, input, "vlan");
  await assertMutable(value.scenarioId, repository);
  return repository.createVlan(value, actor);
}

export async function updateVlan(
  scenarioId: string,
  id: string,
  input: unknown,
  actor = "local-admin",
  repository: NetworkConfigRepository = new PrismaNetworkConfigRepository(),
) {
  const value = parse(vlanSchema, { ...(input as object), scenarioId }, "vlan");
  await assertMutable(scenarioId, repository);
  if (!(await repository.getVlan(id, scenarioId)))
    invalid("VLAN_NOT_FOUND", "VLAN was not found.", 404);
  const { scenarioId: scenarioIdFromBody, ...data } = value;
  void scenarioIdFromBody;
  return repository.updateVlan(id, scenarioId, data, actor);
}

export async function deleteVlan(
  scenarioId: string,
  id: string,
  actor = "local-admin",
  repository: NetworkConfigRepository = new PrismaNetworkConfigRepository(),
) {
  await assertMutable(scenarioId, repository);
  if (!(await repository.deleteVlan(id, scenarioId, actor)))
    invalid("VLAN_NOT_FOUND", "VLAN was not found.", 404);
}

async function validateSubnet(
  value: z.infer<typeof subnetSchema>,
  repository: NetworkConfigRepository,
  excludedId?: string,
) {
  const network = parseIpv4Cidr(value.cidr);
  if (!network) invalid("INVALID_CIDR", "cidr must be a valid IPv4 network.");
  const addresses = [
    value.gateway,
    value.dhcpStart,
    value.dhcpEnd,
    ...value.dnsServers,
  ].filter(Boolean) as string[];
  for (const address of addresses) {
    if (ipv4ToNumber(address) === null)
      invalid("INVALID_IPV4", `${address} is not a valid IPv4 address.`);
  }
  for (const address of [value.gateway, value.dhcpStart, value.dhcpEnd].filter(
    Boolean,
  ) as string[])
    if (!ipv4InNetwork(address, network))
      invalid(
        "IP_OUTSIDE_SUBNET",
        `${address} is outside ${network.canonicalCidr}.`,
      );
  if (
    value.dhcpStart &&
    value.dhcpEnd &&
    ipv4ToNumber(value.dhcpStart)! > ipv4ToNumber(value.dhcpEnd)!
  )
    invalid("INVALID_DHCP_RANGE", "DHCP start must not exceed DHCP end.");
  if (
    value.vlanId &&
    !(await repository.getVlan(value.vlanId, value.scenarioId))
  )
    invalid("VLAN_NOT_FOUND", "VLAN was not found.", 404);
  const peers = await repository.listSubnets(value.scenarioId, excludedId);
  if (
    peers.some((peer) => {
      const peerNetwork = parseIpv4Cidr(peer.cidr);
      return (
        (peer.vrf ?? "") === (value.vrf ?? "") &&
        peerNetwork !== null &&
        ipv4NetworksOverlap(network, peerNetwork)
      );
    })
  )
    invalid(
      "SUBNET_OVERLAP",
      "Subnet overlaps another subnet in the same VRF.",
      409,
    );
  return { ...value, cidr: network.canonicalCidr };
}

export async function createSubnet(
  input: unknown,
  actor = "local-admin",
  repository: NetworkConfigRepository = new PrismaNetworkConfigRepository(),
) {
  const parsed = parse(subnetSchema, input, "subnet");
  await assertMutable(parsed.scenarioId, repository);
  return repository.createSubnet(
    await validateSubnet(parsed, repository),
    actor,
  );
}

export async function updateSubnet(
  scenarioId: string,
  id: string,
  input: unknown,
  actor = "local-admin",
  repository: NetworkConfigRepository = new PrismaNetworkConfigRepository(),
) {
  const parsed = parse(
    subnetSchema,
    { ...(input as object), scenarioId },
    "subnet",
  );
  await assertMutable(scenarioId, repository);
  if (!(await repository.getSubnet(id, scenarioId)))
    invalid("SUBNET_NOT_FOUND", "Subnet was not found.", 404);
  const value = await validateSubnet(parsed, repository, id);
  const { scenarioId: scenarioIdFromBody, ...data } = value;
  void scenarioIdFromBody;
  return repository.updateSubnet(id, scenarioId, data, actor);
}

export async function deleteSubnet(
  scenarioId: string,
  id: string,
  actor = "local-admin",
  repository: NetworkConfigRepository = new PrismaNetworkConfigRepository(),
) {
  await assertMutable(scenarioId, repository);
  if (!(await repository.deleteSubnet(id, scenarioId, actor)))
    invalid("SUBNET_NOT_FOUND", "Subnet was not found.", 404);
}

async function validateMembership(
  value: z.infer<typeof membershipSchema>,
  repository: NetworkConfigRepository,
) {
  if (Boolean(value.portId) === Boolean(value.lagGroupId))
    invalid("INVALID_INTERFACE", "Choose exactly one port or LAG.");
  const allowed = [...new Set(value.allowedVlanIds)];
  if (value.mode === "ACCESS") {
    if (!value.nativeVlanId)
      invalid("ACCESS_VLAN_REQUIRED", "Access mode requires a VLAN.");
    if (allowed.length !== 1 || allowed[0] !== value.nativeVlanId)
      invalid(
        "INVALID_ACCESS_VLANS",
        "Access mode must allow only its native VLAN.",
      );
  } else if (!allowed.length)
    invalid(
      "ALLOWED_VLAN_REQUIRED",
      "Trunk and hybrid modes require allowed VLANs.",
    );
  const refs = [
    ...allowed,
    ...(value.nativeVlanId ? [value.nativeVlanId] : []),
  ];
  if (
    !(await repository.validateMembershipRefs(
      value.scenarioId,
      value.portId ?? null,
      value.lagGroupId ?? null,
      refs,
    ))
  )
    invalid(
      "INVALID_MEMBERSHIP_REFS",
      "Interface and VLANs must exist in the selected scenario.",
      404,
    );
  return { ...value, allowedVlanIds: allowed };
}

export async function createMembership(
  input: unknown,
  actor = "local-admin",
  repository: NetworkConfigRepository = new PrismaNetworkConfigRepository(),
) {
  const parsed = parse(membershipSchema, input, "membership");
  await assertMutable(parsed.scenarioId, repository);
  const value = await validateMembership(parsed, repository);
  const { allowedVlanIds, ...data } = value;
  return repository.createMembership(data, allowedVlanIds, actor);
}

export async function updateMembership(
  scenarioId: string,
  id: string,
  input: unknown,
  actor = "local-admin",
  repository: NetworkConfigRepository = new PrismaNetworkConfigRepository(),
) {
  const parsed = parse(
    membershipSchema,
    { ...(input as object), scenarioId },
    "membership",
  );
  await assertMutable(scenarioId, repository);
  if (!(await repository.getMembership(id, scenarioId)))
    invalid("MEMBERSHIP_NOT_FOUND", "VLAN membership was not found.", 404);
  const value = await validateMembership(parsed, repository);
  const { allowedVlanIds, scenarioId: scenarioIdFromBody, ...data } = value;
  void scenarioIdFromBody;
  return repository.updateMembership(
    id,
    scenarioId,
    data,
    allowedVlanIds,
    actor,
  );
}

export async function deleteMembership(
  scenarioId: string,
  id: string,
  actor = "local-admin",
  repository: NetworkConfigRepository = new PrismaNetworkConfigRepository(),
) {
  await assertMutable(scenarioId, repository);
  if (!(await repository.deleteMembership(id, scenarioId, actor)))
    invalid("MEMBERSHIP_NOT_FOUND", "VLAN membership was not found.", 404);
}
