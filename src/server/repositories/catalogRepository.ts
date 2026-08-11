import type { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "@/server/db/client";

const catalogInclude = {
  vendor: true,
  portProfiles: {
    orderBy: [{ sortOrder: "asc" as const }, { portGroup: "asc" as const }],
  },
  _count: { select: { instances: true } },
} satisfies Prisma.DeviceModelInclude;

export type CatalogModelRecord = Prisma.DeviceModelGetPayload<{
  include: typeof catalogInclude;
}>;

export interface CatalogFilters {
  search?: string;
  vendorId?: string;
  category?: Prisma.EnumDeviceCategoryFilter["equals"];
}

export interface CatalogRepository {
  list(filters: CatalogFilters): Promise<CatalogModelRecord[]>;
  findById(id: string): Promise<CatalogModelRecord | null>;
  create(data: Prisma.DeviceModelCreateInput): Promise<CatalogModelRecord>;
  update(
    id: string,
    data: Prisma.DeviceModelUpdateInput,
  ): Promise<CatalogModelRecord>;
  delete(id: string): Promise<void>;
}

export class PrismaCatalogRepository implements CatalogRepository {
  private readonly prisma = getPrismaClient();

  list(filters: CatalogFilters): Promise<CatalogModelRecord[]> {
    return this.prisma.deviceModel.findMany({
      where: {
        vendorId: filters.vendorId,
        category: filters.category,
        OR: filters.search
          ? [
              { sku: { contains: filters.search, mode: "insensitive" } },
              { modelName: { contains: filters.search, mode: "insensitive" } },
              {
                vendor: {
                  name: { contains: filters.search, mode: "insensitive" },
                },
              },
            ]
          : undefined,
      },
      include: catalogInclude,
      orderBy: [
        { category: "asc" },
        { vendor: { name: "asc" } },
        { modelName: "asc" },
      ],
    });
  }

  findById(id: string): Promise<CatalogModelRecord | null> {
    return this.prisma.deviceModel.findUnique({
      where: { id },
      include: catalogInclude,
    });
  }

  create(data: Prisma.DeviceModelCreateInput): Promise<CatalogModelRecord> {
    return this.prisma.deviceModel.create({ data, include: catalogInclude });
  }

  update(
    id: string,
    data: Prisma.DeviceModelUpdateInput,
  ): Promise<CatalogModelRecord> {
    return this.prisma.deviceModel.update({
      where: { id },
      data,
      include: catalogInclude,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.deviceModel.delete({ where: { id } });
  }
}
