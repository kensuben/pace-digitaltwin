import { randomUUID } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "@/server/db/client";

const lagInclude = {
  device: { include: { model: true } },
  members: {
    include: { port: true },
    orderBy: { port: { index: "asc" as const } },
  },
} satisfies Prisma.LagGroupInclude;
const vlanInclude = {
  subnets: { orderBy: { cidr: "asc" as const } },
} satisfies Prisma.VlanInclude;
const membershipInclude = {
  port: { include: { device: true } },
  lagGroup: { include: { device: true } },
  nativeVlan: true,
  allowedVlans: { include: { vlan: true } },
} satisfies Prisma.VlanMembershipInclude;

export type LagRecord = Prisma.LagGroupGetPayload<{
  include: typeof lagInclude;
}>;
export type VlanRecord = Prisma.VlanGetPayload<{ include: typeof vlanInclude }>;
export type MembershipRecord = Prisma.VlanMembershipGetPayload<{
  include: typeof membershipInclude;
}>;

export interface NetworkConfigRepository {
  getScenario(id: string): Promise<{ id: string; isLocked: boolean } | null>;
  listScenario(id: string): Promise<unknown>;
  getLag(id: string, scenarioId: string): Promise<LagRecord | null>;
  createLag(
    data: Prisma.LagGroupUncheckedCreateInput,
    memberIds: string[],
    actor: string,
  ): Promise<LagRecord>;
  updateLag(
    id: string,
    scenarioId: string,
    data: Prisma.LagGroupUncheckedUpdateInput,
    memberIds: string[],
    actor: string,
  ): Promise<LagRecord>;
  deleteLag(id: string, scenarioId: string, actor: string): Promise<boolean>;
  getPorts(
    scenarioId: string,
    ids: string[],
  ): Promise<
    Array<{
      id: string;
      deviceInstanceId: string;
      supportedSpeedsMbps: number[];
    }>
  >;
  getDeviceContext(
    id: string,
    scenarioId: string,
  ): Promise<{
    id: string;
    supportsLacp: boolean;
    maxLagGroups: number | null;
    maxLagMembers: number | null;
    lagCount: number;
  } | null>;
  getVlan(id: string, scenarioId: string): Promise<VlanRecord | null>;
  createVlan(
    data: Prisma.VlanUncheckedCreateInput,
    actor: string,
  ): Promise<VlanRecord>;
  updateVlan(
    id: string,
    scenarioId: string,
    data: Prisma.VlanUncheckedUpdateInput,
    actor: string,
  ): Promise<VlanRecord>;
  deleteVlan(id: string, scenarioId: string, actor: string): Promise<boolean>;
  getSubnet(
    id: string,
    scenarioId: string,
  ): Promise<Prisma.SubnetGetPayload<object> | null>;
  listSubnets(
    scenarioId: string,
    excludedId?: string,
  ): Promise<Array<{ id: string; cidr: string; vrf: string | null }>>;
  createSubnet(
    data: Prisma.SubnetUncheckedCreateInput,
    actor: string,
  ): Promise<Prisma.SubnetGetPayload<object>>;
  updateSubnet(
    id: string,
    scenarioId: string,
    data: Prisma.SubnetUncheckedUpdateInput,
    actor: string,
  ): Promise<Prisma.SubnetGetPayload<object>>;
  deleteSubnet(id: string, scenarioId: string, actor: string): Promise<boolean>;
  getMembership(
    id: string,
    scenarioId: string,
  ): Promise<MembershipRecord | null>;
  createMembership(
    data: Prisma.VlanMembershipUncheckedCreateInput,
    allowedIds: string[],
    actor: string,
  ): Promise<MembershipRecord>;
  updateMembership(
    id: string,
    scenarioId: string,
    data: Prisma.VlanMembershipUncheckedUpdateInput,
    allowedIds: string[],
    actor: string,
  ): Promise<MembershipRecord>;
  deleteMembership(
    id: string,
    scenarioId: string,
    actor: string,
  ): Promise<boolean>;
  validateMembershipRefs(
    scenarioId: string,
    portId: string | null,
    lagId: string | null,
    vlanIds: string[],
  ): Promise<boolean>;
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export class PrismaNetworkConfigRepository implements NetworkConfigRepository {
  private readonly prisma = getPrismaClient();
  getScenario(id: string) {
    return this.prisma.scenario.findUnique({
      where: { id },
      select: { id: true, isLocked: true },
    });
  }
  async listScenario(id: string) {
    const [scenario, lags, vlans, subnets, memberships, devices] =
      await Promise.all([
        this.prisma.scenario.findUnique({
          where: { id },
          select: { id: true, name: true, isLocked: true },
        }),
        this.prisma.lagGroup.findMany({
          where: { scenarioId: id },
          include: lagInclude,
          orderBy: [{ device: { hostname: "asc" } }, { name: "asc" }],
        }),
        this.prisma.vlan.findMany({
          where: { scenarioId: id },
          include: vlanInclude,
          orderBy: { vlanId: "asc" },
        }),
        this.prisma.subnet.findMany({
          where: { scenarioId: id },
          include: { vlan: true },
          orderBy: { cidr: "asc" },
        }),
        this.prisma.vlanMembership.findMany({
          where: { scenarioId: id },
          include: membershipInclude,
          orderBy: { createdAt: "asc" },
        }),
        this.prisma.deviceInstance.findMany({
          where: { scenarioId: id },
          select: {
            id: true,
            hostname: true,
            ports: {
              select: { id: true, name: true, supportedSpeedsMbps: true },
              orderBy: { index: "asc" },
            },
          },
          orderBy: { hostname: "asc" },
        }),
      ]);
    return { scenario, lags, vlans, subnets, memberships, devices };
  }
  getLag(id: string, scenarioId: string) {
    return this.prisma.lagGroup.findUnique({
      where: { id_scenarioId: { id, scenarioId } },
      include: lagInclude,
    });
  }
  async createLag(
    data: Prisma.LagGroupUncheckedCreateInput,
    memberIds: string[],
    actor: string,
  ) {
    const id = data.id ?? randomUUID();
    await this.prisma.$transaction([
      this.prisma.lagGroup.create({ data: { ...data, id } }),
      this.prisma.lagMember.createMany({
        data: memberIds.map((portId) => ({
          lagGroupId: id,
          portId,
          scenarioId: data.scenarioId,
        })),
      }),
      this.prisma.auditLog.create({
        data: {
          scenarioId: data.scenarioId,
          actorId: actor,
          action: "CREATE",
          entityType: "LagGroup",
          entityId: id,
          afterJson: json({ ...data, memberIds }),
        },
      }),
    ]);
    return (await this.getLag(id, data.scenarioId))!;
  }
  async updateLag(
    id: string,
    scenarioId: string,
    data: Prisma.LagGroupUncheckedUpdateInput,
    memberIds: string[],
    actor: string,
  ) {
    const before = await this.getLag(id, scenarioId);
    await this.prisma.$transaction([
      this.prisma.lagMember.deleteMany({
        where: { lagGroupId: id, scenarioId },
      }),
      this.prisma.lagGroup.update({
        where: { id_scenarioId: { id, scenarioId } },
        data,
      }),
      this.prisma.lagMember.createMany({
        data: memberIds.map((portId) => ({
          lagGroupId: id,
          portId,
          scenarioId,
        })),
      }),
      this.prisma.auditLog.create({
        data: {
          scenarioId,
          actorId: actor,
          action: "UPDATE",
          entityType: "LagGroup",
          entityId: id,
          beforeJson: json(before),
          afterJson: json({ ...data, memberIds }),
        },
      }),
    ]);
    return (await this.getLag(id, scenarioId))!;
  }
  async deleteLag(id: string, scenarioId: string, actor: string) {
    const before = await this.getLag(id, scenarioId);
    if (!before) return false;
    await this.prisma.$transaction([
      this.prisma.lagGroup.delete({
        where: { id_scenarioId: { id, scenarioId } },
      }),
      this.prisma.auditLog.create({
        data: {
          scenarioId,
          actorId: actor,
          action: "DELETE",
          entityType: "LagGroup",
          entityId: id,
          beforeJson: json(before),
        },
      }),
    ]);
    return true;
  }
  getPorts(scenarioId: string, ids: string[]) {
    return this.prisma.port.findMany({
      where: { scenarioId, id: { in: ids } },
      select: { id: true, deviceInstanceId: true, supportedSpeedsMbps: true },
    });
  }
  async getDeviceContext(id: string, scenarioId: string) {
    const value = await this.prisma.deviceInstance.findUnique({
      where: { id_scenarioId: { id, scenarioId } },
      select: {
        id: true,
        model: {
          select: {
            supportsLacp: true,
            maxLagGroups: true,
            maxLagMembers: true,
          },
        },
        _count: { select: { lagGroups: true } },
      },
    });
    return value
      ? { id: value.id, ...value.model, lagCount: value._count.lagGroups }
      : null;
  }
  getVlan(id: string, scenarioId: string) {
    return this.prisma.vlan.findUnique({
      where: { id_scenarioId: { id, scenarioId } },
      include: vlanInclude,
    });
  }
  async createVlan(data: Prisma.VlanUncheckedCreateInput, actor: string) {
    const id = data.id ?? randomUUID();
    await this.prisma.$transaction([
      this.prisma.vlan.create({ data: { ...data, id } }),
      this.prisma.auditLog.create({
        data: {
          scenarioId: data.scenarioId,
          actorId: actor,
          action: "CREATE",
          entityType: "Vlan",
          entityId: id,
          afterJson: json(data),
        },
      }),
    ]);
    return (await this.getVlan(id, data.scenarioId))!;
  }
  async updateVlan(
    id: string,
    scenarioId: string,
    data: Prisma.VlanUncheckedUpdateInput,
    actor: string,
  ) {
    const before = await this.getVlan(id, scenarioId);
    await this.prisma.$transaction([
      this.prisma.vlan.update({
        where: { id_scenarioId: { id, scenarioId } },
        data,
      }),
      this.prisma.auditLog.create({
        data: {
          scenarioId,
          actorId: actor,
          action: "UPDATE",
          entityType: "Vlan",
          entityId: id,
          beforeJson: json(before),
          afterJson: json(data),
        },
      }),
    ]);
    return (await this.getVlan(id, scenarioId))!;
  }
  async deleteVlan(id: string, scenarioId: string, actor: string) {
    const before = await this.getVlan(id, scenarioId);
    if (!before) return false;
    await this.prisma.$transaction([
      this.prisma.vlan.delete({ where: { id_scenarioId: { id, scenarioId } } }),
      this.prisma.auditLog.create({
        data: {
          scenarioId,
          actorId: actor,
          action: "DELETE",
          entityType: "Vlan",
          entityId: id,
          beforeJson: json(before),
        },
      }),
    ]);
    return true;
  }
  getSubnet(id: string, scenarioId: string) {
    return this.prisma.subnet.findUnique({
      where: { id_scenarioId: { id, scenarioId } },
    });
  }
  listSubnets(scenarioId: string, excludedId?: string) {
    return this.prisma.subnet.findMany({
      where: { scenarioId, id: excludedId ? { not: excludedId } : undefined },
      select: { id: true, cidr: true, vrf: true },
    });
  }
  async createSubnet(data: Prisma.SubnetUncheckedCreateInput, actor: string) {
    const id = data.id ?? randomUUID();
    const [created] = await this.prisma.$transaction([
      this.prisma.subnet.create({ data: { ...data, id } }),
      this.prisma.auditLog.create({
        data: {
          scenarioId: data.scenarioId,
          actorId: actor,
          action: "CREATE",
          entityType: "Subnet",
          entityId: id,
          afterJson: json(data),
        },
      }),
    ]);
    return created;
  }
  async updateSubnet(
    id: string,
    scenarioId: string,
    data: Prisma.SubnetUncheckedUpdateInput,
    actor: string,
  ) {
    const before = await this.getSubnet(id, scenarioId);
    const [updated] = await this.prisma.$transaction([
      this.prisma.subnet.update({
        where: { id_scenarioId: { id, scenarioId } },
        data,
      }),
      this.prisma.auditLog.create({
        data: {
          scenarioId,
          actorId: actor,
          action: "UPDATE",
          entityType: "Subnet",
          entityId: id,
          beforeJson: json(before),
          afterJson: json(data),
        },
      }),
    ]);
    return updated;
  }
  async deleteSubnet(id: string, scenarioId: string, actor: string) {
    const before = await this.getSubnet(id, scenarioId);
    if (!before) return false;
    await this.prisma.$transaction([
      this.prisma.subnet.delete({
        where: { id_scenarioId: { id, scenarioId } },
      }),
      this.prisma.auditLog.create({
        data: {
          scenarioId,
          actorId: actor,
          action: "DELETE",
          entityType: "Subnet",
          entityId: id,
          beforeJson: json(before),
        },
      }),
    ]);
    return true;
  }
  getMembership(id: string, scenarioId: string) {
    return this.prisma.vlanMembership.findUnique({
      where: { id_scenarioId: { id, scenarioId } },
      include: membershipInclude,
    });
  }
  async createMembership(
    data: Prisma.VlanMembershipUncheckedCreateInput,
    allowedIds: string[],
    actor: string,
  ) {
    const id = data.id ?? randomUUID();
    await this.prisma.$transaction([
      this.prisma.vlanMembership.create({ data: { ...data, id } }),
      this.prisma.vlanMembershipAllowed.createMany({
        data: allowedIds.map((vlanId) => ({
          membershipId: id,
          vlanId,
          scenarioId: data.scenarioId,
        })),
      }),
      this.prisma.auditLog.create({
        data: {
          scenarioId: data.scenarioId,
          actorId: actor,
          action: "CREATE",
          entityType: "VlanMembership",
          entityId: id,
          afterJson: json({ ...data, allowedIds }),
        },
      }),
    ]);
    return (await this.getMembership(id, data.scenarioId))!;
  }
  async updateMembership(
    id: string,
    scenarioId: string,
    data: Prisma.VlanMembershipUncheckedUpdateInput,
    allowedIds: string[],
    actor: string,
  ) {
    const before = await this.getMembership(id, scenarioId);
    await this.prisma.$transaction([
      this.prisma.vlanMembershipAllowed.deleteMany({
        where: { membershipId: id, scenarioId },
      }),
      this.prisma.vlanMembership.update({
        where: { id_scenarioId: { id, scenarioId } },
        data,
      }),
      this.prisma.vlanMembershipAllowed.createMany({
        data: allowedIds.map((vlanId) => ({
          membershipId: id,
          vlanId,
          scenarioId,
        })),
      }),
      this.prisma.auditLog.create({
        data: {
          scenarioId,
          actorId: actor,
          action: "UPDATE",
          entityType: "VlanMembership",
          entityId: id,
          beforeJson: json(before),
          afterJson: json({ ...data, allowedIds }),
        },
      }),
    ]);
    return (await this.getMembership(id, scenarioId))!;
  }
  async deleteMembership(id: string, scenarioId: string, actor: string) {
    const before = await this.getMembership(id, scenarioId);
    if (!before) return false;
    await this.prisma.$transaction([
      this.prisma.vlanMembership.delete({
        where: { id_scenarioId: { id, scenarioId } },
      }),
      this.prisma.auditLog.create({
        data: {
          scenarioId,
          actorId: actor,
          action: "DELETE",
          entityType: "VlanMembership",
          entityId: id,
          beforeJson: json(before),
        },
      }),
    ]);
    return true;
  }
  async validateMembershipRefs(
    scenarioId: string,
    portId: string | null,
    lagId: string | null,
    vlanIds: string[],
  ) {
    const [targets, vlans] = await Promise.all([
      portId
        ? this.prisma.port.count({ where: { id: portId, scenarioId } })
        : this.prisma.lagGroup.count({ where: { id: lagId!, scenarioId } }),
      this.prisma.vlan.count({ where: { id: { in: vlanIds }, scenarioId } }),
    ]);
    return targets === 1 && vlans === new Set(vlanIds).size;
  }
}
