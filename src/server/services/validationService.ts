import { parseIpv4Cidr, ipv4NetworksOverlap } from "@/domain/network/ipv4";
import { AppError } from "@/server/errors";
import {
  PrismaModelSwapRepository,
  type FindingInput,
  type ModelSwapRepository,
} from "@/server/repositories/modelSwapRepository";

export async function validateScenario(
  scenarioId: string,
  repository: ModelSwapRepository = new PrismaModelSwapRepository(),
) {
  if (!scenarioId)
    throw new AppError("SCENARIO_REQUIRED", "scenarioId is required.", 400);
  const context = await repository.getValidationContext(scenarioId);
  if (!context.scenario)
    throw new AppError("SCENARIO_NOT_FOUND", "Scenario was not found.", 404);
  const findings: FindingInput[] = [];
  for (const link of context.links) {
    if (
      !link.sourcePort.supportedSpeedsMbps.includes(link.speedMbps) ||
      !link.targetPort.supportedSpeedsMbps.includes(link.speedMbps)
    )
      findings.push({
        severity: "ERROR",
        ruleCode: "NET-PORT-001",
        entityType: "PhysicalLink",
        entityId: link.id,
        message: `Link speed ${link.speedMbps} Mbps is unsupported by an endpoint.`,
        remediation: "Select a supported speed or compatible ports.",
      });
    if (link.sourcePort.media !== link.targetPort.media)
      findings.push({
        severity: "WARNING",
        ruleCode: "NET-PORT-002",
        entityType: "PhysicalLink",
        entityId: link.id,
        message: "Link endpoint media types differ.",
        remediation: "Verify an approved transceiver or media converter.",
      });
    if (link.status === "INVALID")
      findings.push({
        severity: "ERROR",
        ruleCode: "NET-MODEL-001",
        entityType: "PhysicalLink",
        entityId: link.id,
        message: "Link was invalidated by a model swap.",
        remediation: "Reconnect the link to a compatible target port.",
      });
  }
  for (const lag of context.lags) {
    if (
      lag.device.model.maxLagMembers !== null &&
      lag.members.length > lag.device.model.maxLagMembers
    )
      findings.push({
        severity: "ERROR",
        ruleCode: "NET-LAG-001",
        entityType: "LagGroup",
        entityId: lag.id,
        message: "LAG member count exceeds model capacity.",
      });
    const common = lag.members.reduce(
      (speeds, member) =>
        speeds.filter((speed) =>
          member.port.supportedSpeedsMbps.includes(speed),
        ),
      lag.members[0]?.port.supportedSpeedsMbps ?? [],
    );
    if (!common.length && lag.members.length)
      findings.push({
        severity: "ERROR",
        ruleCode: "NET-LAG-002",
        entityType: "LagGroup",
        entityId: lag.id,
        message: "LAG members have no common speed.",
      });
    if (lag.protocol === "LACP" && !lag.device.model.supportsLacp)
      findings.push({
        severity: "ERROR",
        ruleCode: "NET-LAG-003",
        entityType: "LagGroup",
        entityId: lag.id,
        message: "Device model does not support LACP.",
      });
  }
  for (const membership of context.memberships)
    if (membership.mode === "ACCESS" && membership.allowedVlans.length !== 1)
      findings.push({
        severity: "ERROR",
        ruleCode: "NET-VLAN-001",
        entityType: "VlanMembership",
        entityId: membership.id,
        message: "Access interface must contain exactly one untagged VLAN.",
      });
  for (let index = 0; index < context.subnets.length; index += 1)
    for (let peer = index + 1; peer < context.subnets.length; peer += 1) {
      const a = context.subnets[index];
      const b = context.subnets[peer];
      const an = parseIpv4Cidr(a.cidr);
      const bn = parseIpv4Cidr(b.cidr);
      if (
        (a.vrf ?? "") === (b.vrf ?? "") &&
        an &&
        bn &&
        ipv4NetworksOverlap(an, bn)
      )
        findings.push({
          severity: "ERROR",
          ruleCode: "NET-IP-001",
          entityType: "Subnet",
          entityId: a.id,
          message: `${a.cidr} overlaps ${b.cidr} in the same VRF.`,
        });
    }
  for (const device of context.devices)
    if (!device.placements.length)
      findings.push({
        severity: "WARNING",
        ruleCode: "SPATIAL-001",
        entityType: "DeviceInstance",
        entityId: device.id,
        message: `${device.hostname} has no floor placement.`,
        remediation: "Place the device in the 2D floor editor.",
      });
  for (const map of context.maps)
    if (!map.calibration)
      findings.push({
        severity: "WARNING",
        ruleCode: "SPATIAL-009",
        entityType: "FloorMap",
        entityId: map.id,
        message: `${map.name} is not calibrated.`,
        remediation: "Run two-point calibration.",
      });
  await repository.replaceFindings(scenarioId, findings);
  return findings;
}

export async function listValidationFindings(
  scenarioId: string,
  repository: ModelSwapRepository = new PrismaModelSwapRepository(),
) {
  if (!scenarioId)
    throw new AppError("SCENARIO_REQUIRED", "scenarioId is required.", 400);
  return repository.listFindings(scenarioId);
}
