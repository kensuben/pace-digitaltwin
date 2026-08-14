import { randomUUID } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "@/server/db/client";

export type SpatialZoneWrite = {
  scenarioId: string;
  zoneId: string;
  floorId: string;
  floorMapId: string;
  geometryType: "POLYGON" | "RECTANGLE";
  geometryJson: unknown;
  areaM2: number;
  labelX?: number | null;
  labelY?: number | null;
};
export type CableRouteWrite = {
  scenarioId: string;
  physicalLinkId?: string | null;
  routeType: "COPPER" | "FIBER" | "DAC" | "AOC" | "POWER" | "OTHER";
  sourceDeviceId?: string | null;
  targetDeviceId?: string | null;
  status: "PLANNED" | "INSTALLED" | "VERIFIED";
  calculatedLengthMeters: number;
  points: Array<{
    floorId: string;
    xMeters: number;
    yMeters: number;
    zMeters: number;
    featureId?: string | null;
    riserId?: string | null;
  }>;
};
export type RiserWrite = {
  scenarioId: string;
  buildingId: string;
  code: string;
  name: string;
  type: "DATA" | "POWER" | "FIRE" | "HVAC" | "MIXED";
  xMeters?: number | null;
  yMeters?: number | null;
};
export type RackPlacementWrite = {
  rackId: string;
  zoneId: string;
  scenarioId: string;
  floorId: string;
  floorMapId?: string | null;
  xMeters: number;
  yMeters: number;
  zMeters: number;
  widthMeters: number;
  depthMeters: number;
  heightMeters: number;
  rotationDegrees: number;
};

export interface SpatialPlanningRepository {
  getScenario(id: string): Promise<{ id: string; isLocked: boolean } | null>;
  validateZoneRefs(input: SpatialZoneWrite): Promise<boolean>;
  validateRouteRefs(input: CableRouteWrite): Promise<{
    valid: boolean;
    buildingIds: string[];
    riserFeatureIds: string[];
  }>;
  validateBuilding(id: string): Promise<boolean>;
  createZone(input: SpatialZoneWrite, actor: string): Promise<unknown>;
  updateZone(
    id: string,
    input: SpatialZoneWrite,
    actor: string,
  ): Promise<unknown | null>;
  createRoute(input: CableRouteWrite, actor: string): Promise<unknown>;
  updateRoute(
    id: string,
    input: CableRouteWrite,
    actor: string,
  ): Promise<unknown | null>;
  deleteRoute(id: string, scenarioId: string, actor: string): Promise<boolean>;
  createRiser(input: RiserWrite, actor: string): Promise<unknown>;
  validateRackPlacementRefs(input: RackPlacementWrite): Promise<boolean>;
  createRackPlacement(
    input: RackPlacementWrite,
    actor: string,
  ): Promise<unknown>;
  updateRackPlacement(
    id: string,
    input: RackPlacementWrite,
    actor: string,
  ): Promise<unknown | null>;
  deleteRackPlacement(
    id: string,
    scenarioId: string,
    actor: string,
  ): Promise<boolean>;
}

const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export class PrismaSpatialPlanningRepository implements SpatialPlanningRepository {
  private readonly prisma = getPrismaClient();
  getScenario(id: string) {
    return this.prisma.scenario.findUnique({
      where: { id },
      select: { id: true, isLocked: true },
    });
  }
  async validateBuilding(id: string) {
    return (await this.prisma.building.count({ where: { id } })) === 1;
  }
  async validateZoneRefs(input: SpatialZoneWrite) {
    const [zone, map] = await Promise.all([
      this.prisma.zone.count({
        where: { id: input.zoneId, floorId: input.floorId },
      }),
      this.prisma.floorMap.count({
        where: {
          id: input.floorMapId,
          floorId: input.floorId,
          scenarioId: input.scenarioId,
        },
      }),
    ]);
    return zone === 1 && map === 1;
  }
  async validateRouteRefs(input: CableRouteWrite) {
    const floorIds = [...new Set(input.points.map((point) => point.floorId))];
    const featureIds = input.points.flatMap((point) =>
      point.featureId ? [point.featureId] : [],
    );
    const riserIds = input.points.flatMap((point) =>
      point.riserId ? [point.riserId] : [],
    );
    const [scenario, floors, features, risers, link, source, target] =
      await Promise.all([
        this.prisma.scenario.count({ where: { id: input.scenarioId } }),
        this.prisma.floor.findMany({
          where: { id: { in: floorIds } },
          select: { id: true, buildingId: true },
        }),
        this.prisma.buildingFeature.findMany({
          where: { id: { in: featureIds } },
          select: { id: true, floorId: true, type: true },
        }),
        this.prisma.riser.findMany({
          where: { id: { in: riserIds } },
          select: { id: true, buildingId: true },
        }),
        input.physicalLinkId
          ? this.prisma.physicalLink.count({
              where: { id: input.physicalLinkId, scenarioId: input.scenarioId },
            })
          : 1,
        input.sourceDeviceId
          ? this.prisma.deviceInstance.count({
              where: { id: input.sourceDeviceId, scenarioId: input.scenarioId },
            })
          : 1,
        input.targetDeviceId
          ? this.prisma.deviceInstance.count({
              where: { id: input.targetDeviceId, scenarioId: input.scenarioId },
            })
          : 1,
      ]);
    const featureSet = new Set(
      features.map((feature) => `${feature.id}:${feature.floorId}`),
    );
    return {
      valid:
        scenario === 1 &&
        floors.length === floorIds.length &&
        link === 1 &&
        source === 1 &&
        target === 1 &&
        risers.length === new Set(riserIds).size &&
        risers.every((riser) =>
          floors.every((floor) => floor.buildingId === riser.buildingId),
        ) &&
        input.points.every(
          (point) =>
            !point.featureId ||
            featureSet.has(`${point.featureId}:${point.floorId}`),
        ),
      buildingIds: [...new Set(floors.map((floor) => floor.buildingId))],
      riserFeatureIds: [
        ...risers.map((riser) => riser.id),
        ...features
          .filter(
            (feature) => feature.type === "RISER" || feature.type === "SHAFT",
          )
          .map((feature) => feature.id),
      ],
    };
  }
  async createZone(input: SpatialZoneWrite, actor: string) {
    const map = await this.prisma.floorMap.findUniqueOrThrow({
      where: { id: input.floorMapId },
      select: { coordinateSystemId: true },
    });
    const { scenarioId, geometryJson, ...data } = input;
    const id = randomUUID();
    const [created] = await this.prisma.$transaction([
      this.prisma.spatialZone.create({
        data: {
          ...data,
          id,
          coordinateSystemId: map.coordinateSystemId,
          geometryJson: json(geometryJson),
        },
      }),
      this.prisma.auditLog.create({
        data: {
          scenarioId,
          actorId: actor,
          action: "CREATE",
          entityType: "SpatialZone",
          entityId: id,
          afterJson: json(input),
        },
      }),
    ]);
    return created;
  }
  async updateZone(id: string, input: SpatialZoneWrite, actor: string) {
    const before = await this.prisma.spatialZone.findUnique({ where: { id } });
    if (!before) return null;
    const { scenarioId, geometryJson, ...data } = input;
    const [updated] = await this.prisma.$transaction([
      this.prisma.spatialZone.update({
        where: { id },
        data: {
          ...data,
          geometryJson: json(geometryJson),
          geometryVersion: { increment: 1 },
        },
      }),
      this.prisma.auditLog.create({
        data: {
          scenarioId,
          actorId: actor,
          action: "UPDATE",
          entityType: "SpatialZone",
          entityId: id,
          beforeJson: json(before),
          afterJson: json(input),
        },
      }),
    ]);
    return updated;
  }
  async createRoute(input: CableRouteWrite, actor: string) {
    const id = randomUUID();
    const { points, ...route } = input;
    const [created] = await this.prisma.$transaction([
      this.prisma.cableRoute.create({
        data: {
          ...route,
          id,
          points: {
            create: points.map((point, sequence) => ({
              ...point,
              sequence,
              scenarioId: input.scenarioId,
            })),
          },
        },
        include: { points: { orderBy: { sequence: "asc" } } },
      }),
      this.prisma.auditLog.create({
        data: {
          scenarioId: input.scenarioId,
          actorId: actor,
          action: "CREATE",
          entityType: "CableRoute",
          entityId: id,
          afterJson: json(input),
        },
      }),
    ]);
    return created;
  }
  async updateRoute(id: string, input: CableRouteWrite, actor: string) {
    const before = await this.prisma.cableRoute.findFirst({
      where: { id, scenarioId: input.scenarioId },
      include: { points: true },
    });
    if (!before) return null;
    const { points, ...route } = input;
    const [updated] = await this.prisma.$transaction([
      this.prisma.cableRoute.update({
        where: { id },
        data: {
          ...route,
          points: {
            deleteMany: {},
            create: points.map((point, sequence) => ({
              ...point,
              sequence,
              scenarioId: input.scenarioId,
            })),
          },
        },
        include: { points: { orderBy: { sequence: "asc" } } },
      }),
      this.prisma.auditLog.create({
        data: {
          scenarioId: input.scenarioId,
          actorId: actor,
          action: "UPDATE",
          entityType: "CableRoute",
          entityId: id,
          beforeJson: json(before),
          afterJson: json(input),
        },
      }),
    ]);
    return updated;
  }
  async deleteRoute(id: string, scenarioId: string, actor: string) {
    const before = await this.prisma.cableRoute.findFirst({
      where: { id, scenarioId },
      include: { points: true },
    });
    if (!before) return false;
    await this.prisma.$transaction([
      this.prisma.cableRoute.delete({ where: { id } }),
      this.prisma.auditLog.create({
        data: {
          scenarioId,
          actorId: actor,
          action: "DELETE",
          entityType: "CableRoute",
          entityId: id,
          beforeJson: json(before),
        },
      }),
    ]);
    return true;
  }
  async createRiser(input: RiserWrite, actor: string) {
    const { scenarioId, ...data } = input;
    const id = randomUUID();
    const [created] = await this.prisma.$transaction([
      this.prisma.riser.create({ data: { ...data, id } }),
      this.prisma.auditLog.create({
        data: {
          scenarioId,
          actorId: actor,
          action: "CREATE",
          entityType: "Riser",
          entityId: id,
          afterJson: json(input),
        },
      }),
    ]);
    return created;
  }
  async validateRackPlacementRefs(input: RackPlacementWrite) {
    const [rack, map] = await Promise.all([
      this.prisma.rack.count({
        where: {
          id: input.rackId,
          zoneId: input.zoneId,
          zone: { floorId: input.floorId },
        },
      }),
      input.floorMapId
        ? this.prisma.floorMap.count({
            where: {
              id: input.floorMapId,
              floorId: input.floorId,
              scenarioId: input.scenarioId,
            },
          })
        : 1,
    ]);
    return rack === 1 && map === 1;
  }
  async createRackPlacement(input: RackPlacementWrite, actor: string) {
    const id = randomUUID();
    const [created] = await this.prisma.$transaction([
      this.prisma.rackPlacement.create({
        data: { ...input, id },
        include: { rack: true, zone: true },
      }),
      this.prisma.auditLog.create({
        data: {
          scenarioId: input.scenarioId,
          actorId: actor,
          action: "CREATE",
          entityType: "RackPlacement",
          entityId: id,
          afterJson: json(input),
        },
      }),
    ]);
    return created;
  }
  async updateRackPlacement(
    id: string,
    input: RackPlacementWrite,
    actor: string,
  ) {
    const before = await this.prisma.rackPlacement.findFirst({
      where: { id, scenarioId: input.scenarioId },
    });
    if (!before) return null;
    const [updated] = await this.prisma.$transaction([
      this.prisma.rackPlacement.update({
        where: { id },
        data: input,
        include: { rack: true, zone: true },
      }),
      this.prisma.auditLog.create({
        data: {
          scenarioId: input.scenarioId,
          actorId: actor,
          action: "UPDATE",
          entityType: "RackPlacement",
          entityId: id,
          beforeJson: json(before),
          afterJson: json(input),
        },
      }),
    ]);
    return updated;
  }
  async deleteRackPlacement(id: string, scenarioId: string, actor: string) {
    const before = await this.prisma.rackPlacement.findFirst({
      where: { id, scenarioId },
    });
    if (!before) return false;
    await this.prisma.$transaction([
      this.prisma.rackPlacement.delete({ where: { id } }),
      this.prisma.auditLog.create({
        data: {
          scenarioId,
          actorId: actor,
          action: "DELETE",
          entityType: "RackPlacement",
          entityId: id,
          beforeJson: json(before),
        },
      }),
    ]);
    return true;
  }
}
