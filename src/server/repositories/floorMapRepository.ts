import { randomUUID } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "@/server/db/client";

const mapInclude = {
  drawingPage: true,
  coordinateSystem: true,
  calibration: true,
} satisfies Prisma.FloorMapInclude;

export type FloorMapRecord = Prisma.FloorMapGetPayload<{
  include: typeof mapInclude;
}>;

export interface FloorMapRepository {
  getScenario(id: string): Promise<{ id: string; isLocked: boolean } | null>;
  getFloor(id: string): Promise<{ id: string; buildingId: string } | null>;
  getDrawingPage(
    id: string,
    floorId: string,
  ): Promise<{
    id: string;
    widthPoints: number | null;
    heightPoints: number | null;
  } | null>;
  listMaps(floorId: string, scenarioId: string): Promise<unknown>;
  getMap(id: string): Promise<FloorMapRecord | null>;
  createMap(
    input: {
      floorId: string;
      scenarioId: string;
      drawingPageId: string;
      name: string;
      opacity: number;
    },
    actor: string,
  ): Promise<FloorMapRecord>;
  updateMap(
    id: string,
    data: {
      name?: string;
      opacity?: number;
      rotationDegrees?: number;
      isActive?: boolean;
    },
    actor: string,
  ): Promise<FloorMapRecord>;
  deleteMap(id: string, actor: string): Promise<boolean>;
  calibrate(
    id: string,
    input: {
      pointA: { x: number; y: number };
      pointB: { x: number; y: number };
      realDistanceMeters: number;
      metersPerPdfPoint: number;
      transform: unknown;
      createdBy: string;
    },
    actor: string,
  ): Promise<FloorMapRecord>;
  getSpatial(floorId: string, scenarioId: string): Promise<unknown>;
  getPlacement(id: string, scenarioId: string): Promise<{ id: string } | null>;
  validatePlacementRefs(input: {
    deviceInstanceId: string;
    scenarioId: string;
    floorId: string;
    floorMapId: string | null;
  }): Promise<boolean>;
  createPlacement(
    data: Prisma.DevicePlacementUncheckedCreateInput,
    actor: string,
  ): Promise<unknown>;
  updatePlacement(
    id: string,
    scenarioId: string,
    data: Prisma.DevicePlacementUncheckedUpdateInput,
    actor: string,
  ): Promise<unknown>;
  deletePlacement(
    id: string,
    scenarioId: string,
    actor: string,
  ): Promise<boolean>;
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export class PrismaFloorMapRepository implements FloorMapRepository {
  private readonly prisma = getPrismaClient();

  getScenario(id: string) {
    return this.prisma.scenario.findUnique({
      where: { id },
      select: { id: true, isLocked: true },
    });
  }
  getFloor(id: string) {
    return this.prisma.floor.findUnique({
      where: { id },
      select: { id: true, buildingId: true },
    });
  }
  getDrawingPage(id: string, floorId: string) {
    return this.prisma.drawingPage.findUnique({
      where: { id_floorId: { id, floorId } },
      select: { id: true, widthPoints: true, heightPoints: true },
    });
  }

  async listMaps(floorId: string, scenarioId: string) {
    const [floor, pages, maps] = await Promise.all([
      this.prisma.floor.findUnique({
        where: { id: floorId },
        include: { building: true },
      }),
      this.prisma.drawingPage.findMany({
        where: { floorId },
        select: {
          id: true,
          pageNumber: true,
          widthPoints: true,
          heightPoints: true,
          drawingDocument: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.floorMap.findMany({
        where: { floorId, scenarioId },
        include: mapInclude,
        orderBy: [{ isActive: "desc" }, { revision: "desc" }],
      }),
    ]);
    return { floor, pages, maps };
  }

  getMap(id: string) {
    return this.prisma.floorMap.findUnique({
      where: { id },
      include: mapInclude,
    });
  }

  async createMap(
    input: {
      floorId: string;
      scenarioId: string;
      drawingPageId: string;
      name: string;
      opacity: number;
    },
    actor: string,
  ) {
    const id = randomUUID();
    await this.prisma.$transaction(async (tx) => {
      let coordinate = await tx.spatialCoordinateSystem.findFirst({
        where: { floorId: input.floorId },
        orderBy: { version: "desc" },
      });
      coordinate ??= await tx.spatialCoordinateSystem.create({
        data: {
          floorId: input.floorId,
          name: "Floor local meters",
          unit: "METER",
        },
      });
      const revision =
        (
          await tx.floorMap.aggregate({
            where: {
              floorId: input.floorId,
              scenarioId: input.scenarioId,
              purpose: "FLOOR_PLAN",
            },
            _max: { revision: true },
          })
        )._max.revision ?? 0;
      await tx.floorMap.create({
        data: {
          id,
          ...input,
          sourceType: "PDF_PAGE",
          purpose: "FLOOR_PLAN",
          revision: revision + 1,
          coordinateSystemId: coordinate.id,
        },
      });
      await tx.auditLog.create({
        data: {
          scenarioId: input.scenarioId,
          actorId: actor,
          action: "CREATE",
          entityType: "FloorMap",
          entityId: id,
          afterJson: json(input),
        },
      });
    });
    return (await this.getMap(id))!;
  }

  async updateMap(
    id: string,
    data: {
      name?: string;
      opacity?: number;
      rotationDegrees?: number;
      isActive?: boolean;
    },
    actor: string,
  ) {
    const before = await this.getMap(id);
    if (data.isActive && before)
      await this.prisma.floorMap.updateMany({
        where: {
          floorId: before.floorId,
          scenarioId: before.scenarioId,
          purpose: before.purpose,
          isActive: true,
          id: { not: id },
        },
        data: { isActive: false },
      });
    await this.prisma.$transaction([
      this.prisma.floorMap.update({ where: { id }, data }),
      this.prisma.auditLog.create({
        data: {
          scenarioId: before!.scenarioId!,
          actorId: actor,
          action: "UPDATE",
          entityType: "FloorMap",
          entityId: id,
          beforeJson: json(before),
          afterJson: json(data),
        },
      }),
    ]);
    return (await this.getMap(id))!;
  }

  async deleteMap(id: string, actor: string) {
    const before = await this.getMap(id);
    if (!before) return false;
    await this.prisma.$transaction([
      this.prisma.floorMap.delete({ where: { id } }),
      this.prisma.auditLog.create({
        data: {
          scenarioId: before.scenarioId!,
          actorId: actor,
          action: "DELETE",
          entityType: "FloorMap",
          entityId: id,
          beforeJson: json(before),
        },
      }),
    ]);
    return true;
  }

  async calibrate(
    id: string,
    input: {
      pointA: { x: number; y: number };
      pointB: { x: number; y: number };
      realDistanceMeters: number;
      metersPerPdfPoint: number;
      transform: unknown;
      createdBy: string;
    },
    actor: string,
  ) {
    const map = await this.getMap(id);
    await this.prisma.$transaction([
      this.prisma.scaleCalibration.upsert({
        where: { floorMapId: id },
        create: {
          floorMapId: id,
          pointAPdfX: input.pointA.x,
          pointAPdfY: input.pointA.y,
          pointBPdfX: input.pointB.x,
          pointBPdfY: input.pointB.y,
          realDistanceMeters: input.realDistanceMeters,
          calculatedMetersPerPdfPoint: input.metersPerPdfPoint,
          createdBy: input.createdBy,
        },
        update: {
          pointAPdfX: input.pointA.x,
          pointAPdfY: input.pointA.y,
          pointBPdfX: input.pointB.x,
          pointBPdfY: input.pointB.y,
          realDistanceMeters: input.realDistanceMeters,
          calculatedMetersPerPdfPoint: input.metersPerPdfPoint,
          createdBy: input.createdBy,
        },
      }),
      this.prisma.floorMap.update({
        where: { id },
        data: { pdfToFloorTransform: json(input.transform) },
      }),
      this.prisma.spatialCoordinateSystem.update({
        where: { id: map!.coordinateSystemId },
        data: {
          unitsPerPdfPoint: input.metersPerPdfPoint,
          calibrationStatus: "CALIBRATED",
        },
      }),
      this.prisma.auditLog.create({
        data: {
          scenarioId: map!.scenarioId!,
          actorId: actor,
          action: "CALIBRATE",
          entityType: "FloorMap",
          entityId: id,
          afterJson: json(input),
        },
      }),
    ]);
    return (await this.getMap(id))!;
  }

  async getSpatial(floorId: string, scenarioId: string) {
    const [floor, maps, placements, devices, pages] = await Promise.all([
      this.prisma.floor.findUnique({
        where: { id: floorId },
        include: { building: true },
      }),
      this.prisma.floorMap.findMany({
        where: { floorId, scenarioId },
        include: mapInclude,
        orderBy: [{ isActive: "desc" }, { revision: "desc" }],
      }),
      this.prisma.devicePlacement.findMany({
        where: { floorId, scenarioId },
        include: { device: { include: { model: true } } },
        orderBy: { device: { hostname: "asc" } },
      }),
      this.prisma.deviceInstance.findMany({
        where: { floorId, scenarioId },
        include: { model: true, placement: true },
        orderBy: { hostname: "asc" },
      }),
      this.prisma.drawingPage.findMany({
        where: { floorId },
        select: {
          id: true,
          pageNumber: true,
          drawingDocument: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return { floor, maps, placements, devices, pages };
  }

  getPlacement(id: string, scenarioId: string) {
    return this.prisma.devicePlacement.findFirst({
      where: { id, scenarioId },
      select: { id: true },
    });
  }
  async validatePlacementRefs(input: {
    deviceInstanceId: string;
    scenarioId: string;
    floorId: string;
    floorMapId: string | null;
  }) {
    const [device, map] = await Promise.all([
      this.prisma.deviceInstance.count({
        where: {
          id: input.deviceInstanceId,
          scenarioId: input.scenarioId,
          floorId: input.floorId,
        },
      }),
      input.floorMapId
        ? this.prisma.floorMap.count({
            where: {
              id: input.floorMapId,
              scenarioId: input.scenarioId,
              floorId: input.floorId,
            },
          })
        : Promise.resolve(1),
    ]);
    return device === 1 && map === 1;
  }
  async createPlacement(
    data: Prisma.DevicePlacementUncheckedCreateInput,
    actor: string,
  ) {
    const id = data.id ?? randomUUID();
    const [created] = await this.prisma.$transaction([
      this.prisma.devicePlacement.create({
        data: { ...data, id },
        include: { device: { include: { model: true } } },
      }),
      this.prisma.auditLog.create({
        data: {
          scenarioId: data.scenarioId,
          actorId: actor,
          action: "CREATE",
          entityType: "DevicePlacement",
          entityId: id,
          afterJson: json(data),
        },
      }),
    ]);
    return created;
  }
  async updatePlacement(
    id: string,
    scenarioId: string,
    data: Prisma.DevicePlacementUncheckedUpdateInput,
    actor: string,
  ) {
    const before = await this.prisma.devicePlacement.findFirst({
      where: { id, scenarioId },
    });
    const [updated] = await this.prisma.$transaction([
      this.prisma.devicePlacement.update({
        where: { id },
        data,
        include: { device: { include: { model: true } } },
      }),
      this.prisma.auditLog.create({
        data: {
          scenarioId,
          actorId: actor,
          action: "UPDATE",
          entityType: "DevicePlacement",
          entityId: id,
          beforeJson: json(before),
          afterJson: json(data),
        },
      }),
    ]);
    return updated;
  }
  async deletePlacement(id: string, scenarioId: string, actor: string) {
    const before = await this.prisma.devicePlacement.findFirst({
      where: { id, scenarioId },
    });
    if (!before) return false;
    await this.prisma.$transaction([
      this.prisma.devicePlacement.delete({ where: { id } }),
      this.prisma.auditLog.create({
        data: {
          scenarioId,
          actorId: actor,
          action: "DELETE",
          entityType: "DevicePlacement",
          entityId: id,
          beforeJson: json(before),
        },
      }),
    ]);
    return true;
  }
}
