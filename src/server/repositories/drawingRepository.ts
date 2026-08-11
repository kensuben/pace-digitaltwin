import type { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "@/server/db/client";

const drawingInclude = {
  campus: { select: { id: true, code: true, name: true } },
  building: { select: { id: true, code: true, name: true } },
  _count: {
    select: {
      revisions: true,
      pages: true,
      drawingImportJobs: true,
      models3d: true,
    },
  },
} satisfies Prisma.DrawingDocumentInclude;

export type DrawingDocumentRecord = Prisma.DrawingDocumentGetPayload<{
  include: typeof drawingInclude;
}>;

export interface DrawingFilters {
  campusId?: string;
  buildingId?: string;
  documentType?: Prisma.EnumDrawingDocumentTypeFilter["equals"];
  status?: Prisma.EnumDrawingStatusFilter["equals"];
  search?: string;
}

export interface DrawingRepository {
  list(filters: DrawingFilters): Promise<DrawingDocumentRecord[]>;
  findById(id: string): Promise<DrawingDocumentRecord | null>;
  locationExists(campusId: string, buildingId: string): Promise<boolean>;
  create(
    data: Prisma.DrawingDocumentCreateInput,
  ): Promise<DrawingDocumentRecord>;
  update(
    id: string,
    data: Prisma.DrawingDocumentUpdateInput,
  ): Promise<DrawingDocumentRecord>;
  delete(id: string): Promise<void>;
}

export class PrismaDrawingRepository implements DrawingRepository {
  private readonly prisma = getPrismaClient();

  list(filters: DrawingFilters): Promise<DrawingDocumentRecord[]> {
    return this.prisma.drawingDocument.findMany({
      where: {
        campusId: filters.campusId,
        buildingId: filters.buildingId,
        documentType: filters.documentType,
        status: filters.status,
        OR: filters.search
          ? [
              { name: { contains: filters.search, mode: "insensitive" } },
              {
                building: {
                  name: { contains: filters.search, mode: "insensitive" },
                },
              },
            ]
          : undefined,
      },
      include: drawingInclude,
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    });
  }

  findById(id: string): Promise<DrawingDocumentRecord | null> {
    return this.prisma.drawingDocument.findUnique({
      where: { id },
      include: drawingInclude,
    });
  }

  async locationExists(campusId: string, buildingId: string): Promise<boolean> {
    return (
      (await this.prisma.building.count({
        where: { id: buildingId, campusId },
      })) === 1
    );
  }

  create(
    data: Prisma.DrawingDocumentCreateInput,
  ): Promise<DrawingDocumentRecord> {
    return this.prisma.drawingDocument.create({
      data,
      include: drawingInclude,
    });
  }

  update(
    id: string,
    data: Prisma.DrawingDocumentUpdateInput,
  ): Promise<DrawingDocumentRecord> {
    return this.prisma.drawingDocument.update({
      where: { id },
      data,
      include: drawingInclude,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.drawingDocument.delete({ where: { id } });
  }
}
