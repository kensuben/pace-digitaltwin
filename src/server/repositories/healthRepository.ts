import { getPrismaClient } from "@/server/db/client";

export interface HealthRepository {
  checkConnectivity(): Promise<void>;
}

export class PrismaHealthRepository implements HealthRepository {
  async checkConnectivity(): Promise<void> {
    const prisma = getPrismaClient();
    await prisma.$queryRaw`SELECT 1`;
  }
}
