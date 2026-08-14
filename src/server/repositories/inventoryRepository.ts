import { randomUUID } from "node:crypto";

import type { GeneratedPort } from "@/domain/ports/generatePorts";
import type { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "@/server/db/client";

const inventoryInclude = {
  scenario: true,
  model: { include: { vendor: true } },
  building: true,
  floor: true,
  zone: true,
  rack: true,
  _count: { select: { ports: true } },
} satisfies Prisma.DeviceInstanceInclude;

const inventoryDetailInclude = {
  ...inventoryInclude,
  ports: {
    orderBy: { index: "asc" as const },
    include: {
      sourceLinks: {
        include: { targetPort: { include: { device: true } } },
      },
      targetLinks: {
        include: { sourcePort: { include: { device: true } } },
      },
    },
  },
} satisfies Prisma.DeviceInstanceInclude;

export type InventoryRecord = Prisma.DeviceInstanceGetPayload<{
  include: typeof inventoryInclude;
}>;
export type InventoryDetailRecord = Prisma.DeviceInstanceGetPayload<{
  include: typeof inventoryDetailInclude;
}>;

export interface InventoryFilters {
  scenarioId?: string;
  search?: string;
  status?: Prisma.EnumDeviceStatusFilter["equals"];
  category?: Prisma.EnumDeviceCategoryFilter["equals"];
}

export interface CreateDeviceRecord {
  scenarioId: string;
  hostname: string;
  displayName: string;
  assetTag?: string | null;
  modelId: string;
  serialNumber?: string | null;
  managementIp?: string | null;
  buildingId: string;
  floorId: string;
  zoneId?: string | null;
  rackId?: string | null;
  rackUnitStart?: number | null;
  notes?: string | null;
}

export interface InventoryCreationContext {
  scenario: { id: string; isLocked: boolean } | null;
  profiles: Array<{
    portGroup: string;
    count: number;
    media: GeneratedPort["media"];
    supportedSpeedsMbps: number[];
    poeStandard: GeneratedPort["poeStandard"];
    roleHint: GeneratedPort["roleHint"];
    breakoutCapable: boolean;
    namePrefix: string;
    startNumber: number;
    sortOrder: number;
  }> | null;
  locationValid: boolean;
}

export interface InventoryRepository {
  list(filters: InventoryFilters): Promise<InventoryRecord[]>;
  findByIdInScenario(
    id: string,
    scenarioId: string,
  ): Promise<InventoryDetailRecord | null>;
  getCreationContext(
    input: CreateDeviceRecord,
  ): Promise<InventoryCreationContext>;
  createWithPorts(
    input: CreateDeviceRecord,
    ports: GeneratedPort[],
  ): Promise<InventoryDetailRecord>;
  updateInScenario(
    id: string,
    scenarioId: string,
    data: Prisma.DeviceInstanceUncheckedUpdateInput,
  ): Promise<InventoryDetailRecord | null>;
  deleteInScenario(id: string, scenarioId: string): Promise<boolean>;
  findHostnameConflict?(
    scenarioId: string,
    hostname: string,
    excludedId: string,
  ): Promise<boolean>;
  listOptions(): Promise<{
    scenarios: Array<{ id: string; name: string; isLocked: boolean }>;
    models: Array<{
      id: string;
      sku: string;
      modelName: string;
      category: string;
    }>;
    vendors: Array<{ id: string; name: string }>;
    buildings: Prisma.BuildingGetPayload<{
      include: { floors: { include: { zones: { include: { racks: true } } } } };
    }>[];
  }>;
}

export class PrismaInventoryRepository implements InventoryRepository {
  private readonly prisma = getPrismaClient();

  list(filters: InventoryFilters): Promise<InventoryRecord[]> {
    return this.prisma.deviceInstance.findMany({
      where: {
        scenarioId: filters.scenarioId,
        status: filters.status,
        model: { category: filters.category },
        OR: filters.search
          ? [
              { hostname: { contains: filters.search, mode: "insensitive" } },
              {
                displayName: { contains: filters.search, mode: "insensitive" },
              },
              {
                model: {
                  modelName: { contains: filters.search, mode: "insensitive" },
                },
              },
            ]
          : undefined,
      },
      include: inventoryInclude,
      orderBy: [{ scenario: { type: "asc" } }, { hostname: "asc" }],
    });
  }

  findByIdInScenario(
    id: string,
    scenarioId: string,
  ): Promise<InventoryDetailRecord | null> {
    return this.prisma.deviceInstance.findUnique({
      where: { id_scenarioId: { id, scenarioId } },
      include: inventoryDetailInclude,
    });
  }

  async getCreationContext(
    input: CreateDeviceRecord,
  ): Promise<InventoryCreationContext> {
    const [scenario, model, floor, zone, rack] = await Promise.all([
      this.prisma.scenario.findUnique({
        where: { id: input.scenarioId },
        select: { id: true, isLocked: true },
      }),
      this.prisma.deviceModel.findUnique({
        where: { id: input.modelId },
        select: {
          portProfiles: {
            orderBy: [{ sortOrder: "asc" }, { portGroup: "asc" }],
            select: {
              portGroup: true,
              count: true,
              media: true,
              supportedSpeedsMbps: true,
              poeStandard: true,
              roleHint: true,
              breakoutCapable: true,
              namePrefix: true,
              startNumber: true,
              sortOrder: true,
            },
          },
        },
      }),
      this.prisma.floor.findUnique({
        where: {
          id_buildingId: { id: input.floorId, buildingId: input.buildingId },
        },
        select: { id: true },
      }),
      input.zoneId
        ? this.prisma.zone.findUnique({
            where: { id_floorId: { id: input.zoneId, floorId: input.floorId } },
            select: { id: true },
          })
        : Promise.resolve(null),
      input.rackId && input.zoneId
        ? this.prisma.rack.findUnique({
            where: { id_zoneId: { id: input.rackId, zoneId: input.zoneId } },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    return {
      scenario,
      profiles: model?.portProfiles ?? null,
      locationValid:
        Boolean(floor) &&
        (!input.zoneId || Boolean(zone)) &&
        (!input.rackId || Boolean(rack)),
    };
  }

  async createWithPorts(
    input: CreateDeviceRecord,
    ports: GeneratedPort[],
  ): Promise<InventoryDetailRecord> {
    const deviceId = randomUUID();
    await this.prisma.$transaction([
      this.prisma.deviceInstance.create({ data: { id: deviceId, ...input } }),
      this.prisma.port.createMany({
        data: ports.map((port) => ({
          ...port,
          scenarioId: input.scenarioId,
          deviceInstanceId: deviceId,
        })),
      }),
    ]);
    const created = await this.findByIdInScenario(deviceId, input.scenarioId);
    if (!created) throw new Error("Created device could not be reloaded.");
    return created;
  }

  async updateInScenario(
    id: string,
    scenarioId: string,
    data: Prisma.DeviceInstanceUncheckedUpdateInput,
  ): Promise<InventoryDetailRecord | null> {
    const before = await this.prisma.deviceInstance.findUnique({
      where: { id_scenarioId: { id, scenarioId } },
      select: { floorId: true },
    });
    if (!before) return null;
    const result = await this.prisma.$transaction(async (tx) => {
      if (typeof data.floorId === "string" && data.floorId !== before.floorId)
        await tx.devicePlacement.deleteMany({
          where: { deviceInstanceId: id, scenarioId },
        });
      return tx.deviceInstance.updateMany({ where: { id, scenarioId }, data });
    });
    return result.count === 0 ? null : this.findByIdInScenario(id, scenarioId);
  }

  async deleteInScenario(id: string, scenarioId: string): Promise<boolean> {
    const ports = await this.prisma.port.findMany({
      where: { deviceInstanceId: id, scenarioId },
      select: { id: true },
    });
    const portIds = ports.map((port) => port.id);
    return this.prisma.$transaction(async (tx) => {
      const affectedLinks = await tx.physicalLink.findMany({
        where: {
          scenarioId,
          OR: [
            { sourcePortId: { in: portIds } },
            { targetPortId: { in: portIds } },
          ],
        },
        select: { id: true },
      });
      await tx.cableRoute.deleteMany({
        where: {
          scenarioId,
          OR: [
            { physicalLinkId: { in: affectedLinks.map((link) => link.id) } },
            { sourceDeviceId: id },
            { targetDeviceId: id },
          ],
        },
      });
      await tx.physicalLink.deleteMany({
        where: {
          scenarioId,
          OR: [
            { sourcePortId: { in: portIds } },
            { targetPortId: { in: portIds } },
          ],
        },
      });
      const result = await tx.deviceInstance.deleteMany({
        where: { id, scenarioId },
      });
      return result.count > 0;
    });
  }

  async findHostnameConflict(
    scenarioId: string,
    hostname: string,
    excludedId: string,
  ) {
    return Boolean(
      await this.prisma.deviceInstance.findFirst({
        where: { scenarioId, hostname, id: { not: excludedId } },
        select: { id: true },
      }),
    );
  }

  async listOptions() {
    const [scenarios, models, vendors, buildings] = await Promise.all([
      this.prisma.scenario.findMany({
        select: { id: true, name: true, isLocked: true },
        orderBy: { type: "asc" },
      }),
      this.prisma.deviceModel.findMany({
        select: { id: true, sku: true, modelName: true, category: true },
        orderBy: { modelName: "asc" },
      }),
      this.prisma.vendor.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.building.findMany({
        include: {
          floors: {
            include: {
              zones: { include: { racks: true }, orderBy: { code: "asc" } },
            },
            orderBy: { level: "asc" },
          },
        },
        orderBy: { code: "asc" },
      }),
    ]);
    return { scenarios, models, vendors, buildings };
  }
}
