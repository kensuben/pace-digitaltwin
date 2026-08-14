import { getPrismaClient } from "@/server/db/client";

export interface ProjectCostRepository {
  listScenarios(): Promise<Array<{ id: string; name: string; type: string }>>;
  getScenarioCostData(id: string): Promise<unknown | null>;
}

export class PrismaProjectCostRepository implements ProjectCostRepository {
  private readonly prisma = getPrismaClient();

  listScenarios() {
    return this.prisma.scenario.findMany({
      select: { id: true, name: true, type: true },
      orderBy: { createdAt: "asc" },
    });
  }

  getScenarioCostData(id: string) {
    return this.prisma.scenario.findUnique({
      where: { id },
      include: {
        devices: {
          include: { model: { include: { vendor: true } } },
          orderBy: { hostname: "asc" },
        },
        costItems: { orderBy: [{ category: "asc" }, { code: "asc" }] },
      },
    });
  }
}
