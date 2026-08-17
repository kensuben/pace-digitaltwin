import type { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "@/server/db/client";

const rackRoomInclude = {
  floors: {
    where: { code: "B2" },
    include: {
      zones: {
        where: { type: "SERVER_ROOM" },
        include: {
          racks: {
            include: {
              devices: {
                include: { model: { include: { vendor: true } } },
                orderBy: [{ rackUnitStart: "desc" as const }, { hostname: "asc" as const }],
              },
            },
            orderBy: { code: "asc" as const },
          },
        },
      },
    },
  },
} satisfies Prisma.BuildingInclude;

export type RackRoomBuilding = Prisma.BuildingGetPayload<{
  include: typeof rackRoomInclude;
}>;

export interface RackDesignRepository {
  getScenario(id: string): Promise<{ id: string; name: string; isLocked: boolean } | null>;
  getB2Room(scenarioId: string): Promise<{
    buildings: RackRoomBuilding[];
    unplacedDevices: Array<{
      id: string;
      hostname: string;
      displayName: string;
      rackId: string | null;
      rackUnitStart: number | null;
      model: { category: string; rackUnits: number | null; sku: string; modelName: string; vendor: { name: string } };
    }>;
  }>;
  getPlacementContext(scenarioId: string, deviceId: string, rackId: string | null): Promise<{
    scenario: { isLocked: boolean } | null;
    device: { id: string; floorId: string; model: { rackUnits: number | null } } | null;
    rack: { id: string; zoneId: string; rackUnits: number; zone: { floorId: string } } | null;
    occupants: Array<{ id: string; hostname: string; rackUnitStart: number | null; model: { rackUnits: number | null } }>;
  }>;
  savePlacement(scenarioId: string, deviceId: string, rackId: string | null, zoneId: string | null, rackUnitStart: number | null): Promise<boolean>;
}

export class PrismaRackDesignRepository implements RackDesignRepository {
  private readonly prisma = getPrismaClient();

  getScenario(id: string) {
    return this.prisma.scenario.findUnique({
      where: { id },
      select: { id: true, name: true, isLocked: true },
    });
  }

  async getB2Room(scenarioId: string) {
    const [buildings, unplacedDevices] = await Promise.all([
      this.prisma.building.findMany({ include: rackRoomInclude, orderBy: { code: "asc" } }),
      this.prisma.deviceInstance.findMany({
        where: { scenarioId, floor: { code: "B2" }, rackId: null },
        select: {
          id: true, hostname: true, displayName: true, rackId: true, rackUnitStart: true,
          model: { select: { category: true, rackUnits: true, sku: true, modelName: true, vendor: { select: { name: true } } } },
        },
        orderBy: { hostname: "asc" },
      }),
    ]);
    // Rack.devices is not scenario-scoped by the relation, so filter before crossing the server boundary.
    for (const building of buildings)
      for (const floor of building.floors)
        for (const zone of floor.zones)
          for (const rack of zone.racks)
            rack.devices = rack.devices.filter((device) => device.scenarioId === scenarioId);
    return { buildings, unplacedDevices };
  }

  async getPlacementContext(scenarioId: string, deviceId: string, rackId: string | null) {
    const [scenario, device, rack, occupants] = await Promise.all([
      this.prisma.scenario.findUnique({ where: { id: scenarioId }, select: { isLocked: true } }),
      this.prisma.deviceInstance.findUnique({
        where: { id_scenarioId: { id: deviceId, scenarioId } },
        select: { id: true, floorId: true, model: { select: { rackUnits: true } } },
      }),
      rackId
        ? this.prisma.rack.findUnique({
            where: { id: rackId },
            select: { id: true, zoneId: true, rackUnits: true, zone: { select: { floorId: true } } },
          })
        : Promise.resolve(null),
      rackId
        ? this.prisma.deviceInstance.findMany({
            where: { scenarioId, rackId, id: { not: deviceId } },
            select: { id: true, hostname: true, rackUnitStart: true, model: { select: { rackUnits: true } } },
          })
        : Promise.resolve([]),
    ]);
    return { scenario, device, rack, occupants };
  }

  async savePlacement(scenarioId: string, deviceId: string, rackId: string | null, zoneId: string | null, rackUnitStart: number | null) {
    const result = await this.prisma.deviceInstance.updateMany({
      where: { id: deviceId, scenarioId },
      data: { rackId, zoneId, rackUnitStart },
    });
    return result.count === 1;
  }
}
