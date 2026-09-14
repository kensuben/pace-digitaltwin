import type { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "@/server/db/client";

export interface VirtualMachineRepository {
  getHostContext(scenarioId: string, hostDeviceId: string): Promise<{
    scenario: { isLocked: boolean } | null;
    host: { id: string; model: { category: string } } | null;
  }>;
  findById(id: string, scenarioId: string, hostDeviceId: string): Promise<{
    id: string; hostname: string;
  } | null>;
  findHostnameConflict(scenarioId: string, hostname: string, excludedId?: string): Promise<boolean>;
  create(data: Prisma.VirtualMachineUncheckedCreateInput): Promise<Prisma.VirtualMachineGetPayload<Record<string, never>>>;
  update(id: string, scenarioId: string, hostDeviceId: string, data: Prisma.VirtualMachineUncheckedUpdateInput): Promise<boolean>;
  delete(id: string, scenarioId: string, hostDeviceId: string): Promise<boolean>;
}

export class PrismaVirtualMachineRepository implements VirtualMachineRepository {
  private readonly prisma = getPrismaClient();

  async getHostContext(scenarioId: string, hostDeviceId: string) {
    const [scenario, host] = await Promise.all([
      this.prisma.scenario.findUnique({ where: { id: scenarioId }, select: { isLocked: true } }),
      this.prisma.deviceInstance.findUnique({
        where: { id_scenarioId: { id: hostDeviceId, scenarioId } },
        select: { id: true, model: { select: { category: true } } },
      }),
    ]);
    return { scenario, host };
  }

  findById(id: string, scenarioId: string, hostDeviceId: string) {
    return this.prisma.virtualMachine.findFirst({
      where: { id, scenarioId, hostDeviceId },
      select: { id: true, hostname: true },
    });
  }

  async findHostnameConflict(scenarioId: string, hostname: string, excludedId?: string) {
    return Boolean(await this.prisma.virtualMachine.findFirst({
      where: { scenarioId, hostname, id: excludedId ? { not: excludedId } : undefined },
      select: { id: true },
    }));
  }

  create(data: Prisma.VirtualMachineUncheckedCreateInput) {
    return this.prisma.virtualMachine.create({ data });
  }

  async update(id: string, scenarioId: string, hostDeviceId: string, data: Prisma.VirtualMachineUncheckedUpdateInput) {
    const result = await this.prisma.virtualMachine.updateMany({ where: { id, scenarioId, hostDeviceId }, data });
    return result.count === 1;
  }

  async delete(id: string, scenarioId: string, hostDeviceId: string) {
    const result = await this.prisma.virtualMachine.deleteMany({ where: { id, scenarioId, hostDeviceId } });
    return result.count === 1;
  }
}
