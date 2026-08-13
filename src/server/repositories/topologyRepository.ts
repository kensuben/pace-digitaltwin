import type { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "@/server/db/client";

const topologyDeviceInclude = {
  model: { include: { vendor: true } },
  building: true,
  floor: true,
  ports: { orderBy: { index: "asc" as const } },
} satisfies Prisma.DeviceInstanceInclude;

const topologyLinkInclude = {
  sourcePort: { include: { device: true } },
  targetPort: { include: { device: true } },
} satisfies Prisma.PhysicalLinkInclude;

export type TopologyDeviceRecord = Prisma.DeviceInstanceGetPayload<{
  include: typeof topologyDeviceInclude;
}>;
export type TopologyLinkRecord = Prisma.PhysicalLinkGetPayload<{
  include: typeof topologyLinkInclude;
}>;

export interface LinkMutation {
  scenarioId: string;
  sourcePortId: string;
  targetPortId: string;
  linkType: "ETHERNET" | "FIBER" | "DAC" | "AOC";
  speedMbps: number;
  duplex: "FULL" | "HALF" | "AUTO";
  status: "PLANNED" | "ACTIVE" | "INACTIVE" | "INVALID";
  cableLabel?: string | null;
  lengthMeters?: number | null;
}

export interface TopologyRepository {
  getTopology(scenarioId: string): Promise<{
    scenario: { id: string; name: string; isLocked: boolean } | null;
    devices: TopologyDeviceRecord[];
    links: TopologyLinkRecord[];
  }>;
  getScenario(
    scenarioId: string,
  ): Promise<{ id: string; isLocked: boolean } | null>;
  getPorts(
    scenarioId: string,
    portIds: string[],
  ): Promise<
    Array<{
      id: string;
      deviceInstanceId: string;
      supportedSpeedsMbps: number[];
      media: string;
    }>
  >;
  findPortConflict(
    scenarioId: string,
    portIds: string[],
    excludedLinkId?: string,
  ): Promise<{ id: string } | null>;
  findLink(
    scenarioId: string,
    linkId: string,
  ): Promise<TopologyLinkRecord | null>;
  createLink(input: LinkMutation, actorId: string): Promise<TopologyLinkRecord>;
  updateLink(
    linkId: string,
    input: LinkMutation,
    actorId: string,
    before: TopologyLinkRecord,
  ): Promise<TopologyLinkRecord>;
  deleteLink(
    scenarioId: string,
    linkId: string,
    actorId: string,
    before: TopologyLinkRecord,
  ): Promise<void>;
  updatePositions(
    scenarioId: string,
    positions: Array<{ id: string; graphX: number; graphY: number }>,
    actorId: string,
  ): Promise<void>;
}

function auditJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export class PrismaTopologyRepository implements TopologyRepository {
  private readonly prisma = getPrismaClient();

  async getTopology(scenarioId: string) {
    const [scenario, devices, links] = await Promise.all([
      this.prisma.scenario.findUnique({
        where: { id: scenarioId },
        select: { id: true, name: true, isLocked: true },
      }),
      this.prisma.deviceInstance.findMany({
        where: { scenarioId },
        include: topologyDeviceInclude,
        orderBy: { hostname: "asc" },
      }),
      this.prisma.physicalLink.findMany({
        where: { scenarioId },
        include: topologyLinkInclude,
        orderBy: { createdAt: "asc" },
      }),
    ]);
    return { scenario, devices, links };
  }

  getScenario(scenarioId: string) {
    return this.prisma.scenario.findUnique({
      where: { id: scenarioId },
      select: { id: true, isLocked: true },
    });
  }

  getPorts(scenarioId: string, portIds: string[]) {
    return this.prisma.port.findMany({
      where: { scenarioId, id: { in: portIds } },
      select: {
        id: true,
        deviceInstanceId: true,
        supportedSpeedsMbps: true,
        media: true,
      },
    });
  }

  findPortConflict(
    scenarioId: string,
    portIds: string[],
    excludedLinkId?: string,
  ) {
    return this.prisma.physicalLink.findFirst({
      where: {
        scenarioId,
        id: excludedLinkId ? { not: excludedLinkId } : undefined,
        OR: [
          { sourcePortId: { in: portIds } },
          { targetPortId: { in: portIds } },
        ],
      },
      select: { id: true },
    });
  }

  findLink(scenarioId: string, linkId: string) {
    return this.prisma.physicalLink.findFirst({
      where: { id: linkId, scenarioId },
      include: topologyLinkInclude,
    });
  }

  async createLink(input: LinkMutation, actorId: string) {
    const id = crypto.randomUUID();
    await this.prisma.$transaction([
      this.prisma.physicalLink.create({ data: { id, ...input } }),
      this.prisma.auditLog.create({
        data: {
          scenarioId: input.scenarioId,
          actorId,
          action: "CREATE",
          entityType: "PhysicalLink",
          entityId: id,
          afterJson: auditJson(input),
        },
      }),
    ]);
    const created = await this.findLink(input.scenarioId, id);
    if (!created)
      throw new Error("Created physical link could not be reloaded.");
    return created;
  }

  async updateLink(
    linkId: string,
    input: LinkMutation,
    actorId: string,
    before: TopologyLinkRecord,
  ) {
    await this.prisma.$transaction([
      this.prisma.physicalLink.update({
        where: { id_scenarioId: { id: linkId, scenarioId: input.scenarioId } },
        data: input,
      }),
      this.prisma.auditLog.create({
        data: {
          scenarioId: input.scenarioId,
          actorId,
          action: "UPDATE",
          entityType: "PhysicalLink",
          entityId: linkId,
          beforeJson: auditJson(before),
          afterJson: auditJson(input),
        },
      }),
    ]);
    const updated = await this.findLink(input.scenarioId, linkId);
    if (!updated)
      throw new Error("Updated physical link could not be reloaded.");
    return updated;
  }

  async deleteLink(
    scenarioId: string,
    linkId: string,
    actorId: string,
    before: TopologyLinkRecord,
  ) {
    await this.prisma.$transaction([
      this.prisma.physicalLink.delete({
        where: { id_scenarioId: { id: linkId, scenarioId } },
      }),
      this.prisma.auditLog.create({
        data: {
          scenarioId,
          actorId,
          action: "DELETE",
          entityType: "PhysicalLink",
          entityId: linkId,
          beforeJson: auditJson(before),
        },
      }),
    ]);
  }

  async updatePositions(
    scenarioId: string,
    positions: Array<{ id: string; graphX: number; graphY: number }>,
    actorId: string,
  ) {
    await this.prisma.$transaction([
      ...positions.map((position) =>
        this.prisma.deviceInstance.update({
          where: { id_scenarioId: { id: position.id, scenarioId } },
          data: { graphX: position.graphX, graphY: position.graphY },
        }),
      ),
      this.prisma.auditLog.create({
        data: {
          scenarioId,
          actorId,
          action: "MOVE_NODES",
          entityType: "Topology",
          entityId: scenarioId,
          afterJson: auditJson(positions),
        },
      }),
    ]);
  }
}
