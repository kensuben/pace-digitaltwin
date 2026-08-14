import type { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "@/server/db/client";

function inputJson(value: Prisma.JsonValue): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

const scenarioAnalysisInclude = {
  devices: {
    include: {
      model: { include: { vendor: true } },
      ports: { orderBy: { index: "asc" as const } },
    },
    orderBy: { hostname: "asc" as const },
  },
  physicalLinks: {
    include: {
      sourcePort: { include: { device: true } },
      targetPort: { include: { device: true } },
    },
  },
  validationFindings: true,
  costItems: true,
} satisfies Prisma.ScenarioInclude;

export type ScenarioAnalysisRecord = Prisma.ScenarioGetPayload<{
  include: typeof scenarioAnalysisInclude;
}>;
export type ScenarioSummaryRecord = Prisma.ScenarioGetPayload<{
  include: { _count: { select: { devices: true; physicalLinks: true; validationFindings: true } } };
}>;

export interface ScenarioRepository {
  list(): Promise<ScenarioSummaryRecord[]>;
  getAnalysis(id: string): Promise<ScenarioAnalysisRecord | null>;
  clone(sourceId: string, name: string, actorId: string): Promise<{ id: string; name: string }>;
  getDesignContext?(id: string): Promise<unknown | null>;
}

export class PrismaScenarioRepository implements ScenarioRepository {
  private readonly prisma = getPrismaClient();

  list() {
    return this.prisma.scenario.findMany({
      include: { _count: { select: { devices: true, physicalLinks: true, validationFindings: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  getAnalysis(id: string) {
    return this.prisma.scenario.findUnique({ where: { id }, include: scenarioAnalysisInclude });
  }

  async getDesignContext(id: string) {
    const scenario = await this.prisma.scenario.findUnique({
      where: { id },
      select: {
        id: true, name: true, type: true, isLocked: true,
        devices: { orderBy: { hostname: "asc" }, select: {
          id: true, hostname: true, displayName: true, modelId: true,
          model: { select: { category: true, sku: true, modelName: true, unitPriceVnd: true } },
        } },
        physicalLinks: { select: {
          id: true, cableLabel: true, speedMbps: true,
          sourcePort: { select: { device: { select: { hostname: true } } } },
          targetPort: { select: { device: { select: { hostname: true } } } },
        } },
      },
    });
    if (!scenario) return null;
    const models = await this.prisma.deviceModel.findMany({
      select: { id: true, category: true, sku: true, modelName: true, unitPriceVnd: true,
        vendor: { select: { name: true } } },
      orderBy: [{ category: "asc" }, { sku: "asc" }],
    });
    return { scenario, models };
  }

  async clone(sourceId: string, name: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const source = await tx.scenario.findUnique({
        where: { id: sourceId },
        include: {
          devices: { include: { ports: true } },
          physicalLinks: true,
          lagGroups: { include: { members: true } },
          vlans: true,
          subnets: true,
          vlanMemberships: { include: { allowedVlans: true } },
          floorMaps: { include: { calibration: true, spatialZones: true, buildingFeatures: true } },
          devicePlacements: true,
          rackPlacements: true,
          cableRoutes: { include: { points: true } },
          validationFindings: true,
          costItems: true,
        },
      });
      if (!source) throw new Error("SCENARIO_NOT_FOUND");

      const target = await tx.scenario.create({
        data: { name, type: "ALTERNATIVE", parentScenarioId: source.id, createdBy: actorId },
      });
      const deviceIds = new Map<string, string>();
      const portIds = new Map<string, string>();
      const linkIds = new Map<string, string>();
      const lagIds = new Map<string, string>();
      const vlanIds = new Map<string, string>();
      const floorMapIds = new Map<string, string>();
      const featureIds = new Map<string, string>();

      for (const device of source.devices) {
        const id = crypto.randomUUID();
        deviceIds.set(device.id, id);
        await tx.deviceInstance.create({
          data: {
            id, scenarioId: target.id, assetTag: device.assetTag, hostname: device.hostname,
            displayName: device.displayName, modelId: device.modelId, serialNumber: device.serialNumber,
            managementIp: device.managementIp, status: device.status, buildingId: device.buildingId,
            floorId: device.floorId, zoneId: device.zoneId, rackId: device.rackId,
            rackUnitStart: device.rackUnitStart, notes: device.notes, graphX: device.graphX, graphY: device.graphY,
          },
        });
        for (const port of device.ports) {
          const portId = crypto.randomUUID();
          portIds.set(port.id, portId);
          await tx.port.create({
            data: {
              id: portId, scenarioId: target.id, deviceInstanceId: id, name: port.name, index: port.index,
              media: port.media, supportedSpeedsMbps: port.supportedSpeedsMbps, poeStandard: port.poeStandard,
              roleHint: port.roleHint, breakoutCapable: port.breakoutCapable,
              negotiatedSpeedMbps: port.negotiatedSpeedMbps, adminStatus: port.adminStatus,
              operationalStatus: port.operationalStatus, description: port.description,
            },
          });
        }
      }

      for (const device of source.devices) {
        for (const port of device.ports) {
          if (port.parentBreakoutPortId) {
            await tx.port.update({
              where: { id: portIds.get(port.id)! },
              data: { parentBreakoutPortId: portIds.get(port.parentBreakoutPortId) },
            });
          }
        }
      }

      for (const link of source.physicalLinks) {
        const id = crypto.randomUUID();
        linkIds.set(link.id, id);
        await tx.physicalLink.create({
          data: {
            id, scenarioId: target.id, sourcePortId: portIds.get(link.sourcePortId)!,
            targetPortId: portIds.get(link.targetPortId)!, linkType: link.linkType,
            speedMbps: link.speedMbps, duplex: link.duplex, status: link.status,
            cableLabel: link.cableLabel, lengthMeters: link.lengthMeters,
          },
        });
      }

      for (const lag of source.lagGroups) {
        const id = crypto.randomUUID();
        lagIds.set(lag.id, id);
        await tx.lagGroup.create({ data: {
          id, scenarioId: target.id, deviceInstanceId: deviceIds.get(lag.deviceInstanceId)!,
          name: lag.name, protocol: lag.protocol, mode: lag.mode, minLinks: lag.minLinks,
          logicalSpeedPolicy: lag.logicalSpeedPolicy, manualSpeedMbps: lag.manualSpeedMbps,
          description: lag.description,
        } });
        for (const member of lag.members) await tx.lagMember.create({ data: {
          scenarioId: target.id, lagGroupId: id, portId: portIds.get(member.portId)!,
        } });
      }

      for (const vlan of source.vlans) {
        const id = crypto.randomUUID();
        vlanIds.set(vlan.id, id);
        await tx.vlan.create({ data: {
          id, scenarioId: target.id, vlanId: vlan.vlanId, name: vlan.name,
          purpose: vlan.purpose, colorKey: vlan.colorKey,
        } });
      }
      for (const subnet of source.subnets) await tx.subnet.create({ data: {
        scenarioId: target.id, vlanId: subnet.vlanId ? vlanIds.get(subnet.vlanId) : null,
        name: subnet.name, cidr: subnet.cidr, gateway: subnet.gateway, dhcpStart: subnet.dhcpStart,
        dhcpEnd: subnet.dhcpEnd, dnsServers: subnet.dnsServers, vrf: subnet.vrf,
        description: subnet.description,
      } });
      for (const membership of source.vlanMemberships) {
        const id = crypto.randomUUID();
        await tx.vlanMembership.create({ data: {
          id, scenarioId: target.id, portId: membership.portId ? portIds.get(membership.portId) : null,
          lagGroupId: membership.lagGroupId ? lagIds.get(membership.lagGroupId) : null,
          mode: membership.mode, nativeVlanId: membership.nativeVlanId ? vlanIds.get(membership.nativeVlanId) : null,
          description: membership.description,
        } });
        for (const allowed of membership.allowedVlans) await tx.vlanMembershipAllowed.create({ data: {
          membershipId: id, scenarioId: target.id, vlanId: vlanIds.get(allowed.vlanId)!,
        } });
      }

      for (const floorMap of source.floorMaps) {
        const id = crypto.randomUUID();
        floorMapIds.set(floorMap.id, id);
        await tx.floorMap.create({ data: {
          id, floorId: floorMap.floorId, scenarioId: target.id, name: floorMap.name,
          purpose: floorMap.purpose, sourceType: floorMap.sourceType, drawingPageId: floorMap.drawingPageId,
          revision: floorMap.revision, isActive: floorMap.isActive, opacity: floorMap.opacity,
          rotationDegrees: floorMap.rotationDegrees, coordinateSystemId: floorMap.coordinateSystemId,
          pdfToFloorTransform: floorMap.pdfToFloorTransform ?? undefined, cropX: floorMap.cropX,
          cropY: floorMap.cropY, cropWidth: floorMap.cropWidth, cropHeight: floorMap.cropHeight,
        } });
        if (floorMap.calibration) await tx.scaleCalibration.create({ data: {
          floorMapId: id, pointAPdfX: floorMap.calibration.pointAPdfX,
          pointAPdfY: floorMap.calibration.pointAPdfY, pointBPdfX: floorMap.calibration.pointBPdfX,
          pointBPdfY: floorMap.calibration.pointBPdfY, realDistanceMeters: floorMap.calibration.realDistanceMeters,
          calculatedMetersPerPdfPoint: floorMap.calibration.calculatedMetersPerPdfPoint, createdBy: actorId,
        } });
        for (const zone of floorMap.spatialZones) await tx.spatialZone.create({ data: {
          zoneId: zone.zoneId, floorId: zone.floorId, floorMapId: id,
          coordinateSystemId: zone.coordinateSystemId, geometryType: zone.geometryType,
          geometryJson: inputJson(zone.geometryJson), geometryVersion: zone.geometryVersion,
          areaM2: zone.areaM2, labelX: zone.labelX, labelY: zone.labelY,
        } });
        for (const feature of floorMap.buildingFeatures) {
          const featureId = crypto.randomUUID(); featureIds.set(feature.id, featureId);
          await tx.buildingFeature.create({ data: {
            id: featureId, floorId: feature.floorId, floorMapId: id,
            coordinateSystemId: feature.coordinateSystemId, type: feature.type,
            geometryType: feature.geometryType, geometryJson: inputJson(feature.geometryJson),
            geometryVersion: feature.geometryVersion,
            metadataJson: feature.metadataJson === null ? undefined : inputJson(feature.metadataJson),
          } });
        }
      }
      for (const placement of source.devicePlacements) await tx.devicePlacement.create({ data: {
        deviceInstanceId: deviceIds.get(placement.deviceInstanceId)!, scenarioId: target.id,
        floorId: placement.floorId, floorMapId: placement.floorMapId ? floorMapIds.get(placement.floorMapId) : null,
        xMeters: placement.xMeters, yMeters: placement.yMeters, zMeters: placement.zMeters,
        rotationX: placement.rotationX, rotationY: placement.rotationY, rotationZ: placement.rotationZ,
        mountingType: placement.mountingType, anchorType: placement.anchorType,
        placementStatus: placement.placementStatus, notes: placement.notes,
      } });
      for (const placement of source.rackPlacements) await tx.rackPlacement.create({ data: {
        rackId: placement.rackId, zoneId: placement.zoneId, floorId: placement.floorId,
        floorMapId: placement.floorMapId ? floorMapIds.get(placement.floorMapId) : null,
        scenarioId: target.id, xMeters: placement.xMeters, yMeters: placement.yMeters,
        zMeters: placement.zMeters, widthMeters: placement.widthMeters, depthMeters: placement.depthMeters,
        heightMeters: placement.heightMeters, rotationDegrees: placement.rotationDegrees,
      } });
      for (const route of source.cableRoutes) {
        const id = crypto.randomUUID();
        await tx.cableRoute.create({ data: {
          id, scenarioId: target.id, physicalLinkId: route.physicalLinkId ? linkIds.get(route.physicalLinkId) : null,
          routeType: route.routeType, sourceDeviceId: route.sourceDeviceId ? deviceIds.get(route.sourceDeviceId) : null,
          targetDeviceId: route.targetDeviceId ? deviceIds.get(route.targetDeviceId) : null,
          totalLengthMeters: route.totalLengthMeters, calculatedLengthMeters: route.calculatedLengthMeters,
          status: route.status,
        } });
        for (const point of route.points) await tx.cableRoutePoint.create({ data: {
          cableRouteId: id, scenarioId: target.id, sequence: point.sequence, floorId: point.floorId,
          xMeters: point.xMeters, yMeters: point.yMeters, zMeters: point.zMeters,
          featureId: point.featureId ? featureIds.get(point.featureId) : null, riserId: point.riserId,
        } });
      }
      for (const finding of source.validationFindings) await tx.validationFinding.create({ data: {
        scenarioId: target.id, severity: finding.severity, ruleCode: finding.ruleCode,
        entityType: finding.entityType, entityId: deviceIds.get(finding.entityId) ?? linkIds.get(finding.entityId) ?? finding.entityId,
        message: finding.message, remediation: finding.remediation, metadataJson: finding.metadataJson ?? undefined,
      } });
      for (const item of source.costItems) {
        await tx.projectCostItem.create({
          data: {
            scenarioId: target.id, category: item.category, code: item.code,
            description: item.description, quantity: item.quantity, unitCostVnd: item.unitCostVnd,
            vatRateBps: item.vatRateBps, source: item.source, notes: item.notes,
          },
        });
      }
      await tx.auditLog.create({
        data: { scenarioId: target.id, actorId, action: "CLONE", entityType: "Scenario", entityId: target.id,
          afterJson: { sourceScenarioId: source.id, deviceCount: source.devices.length, linkCount: source.physicalLinks.length,
            lagCount: source.lagGroups.length, vlanCount: source.vlans.length, floorMapCount: source.floorMaps.length,
            cableRouteCount: source.cableRoutes.length } },
      });
      return { id: target.id, name: target.name };
    });
  }
}
