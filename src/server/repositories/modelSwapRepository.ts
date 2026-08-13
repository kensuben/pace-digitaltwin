import type { GeneratedPort } from "@/domain/ports/generatePorts";
import type { ExistingSwapPort, PortMapping } from "@/domain/ports/modelSwap";
import type { Prisma, ValidationSeverity } from "@/generated/prisma/client";
import { getPrismaClient } from "@/server/db/client";

export interface FindingInput {
  severity: ValidationSeverity;
  ruleCode: string;
  entityType: string;
  entityId: string;
  message: string;
  remediation?: string;
  metadataJson?: Record<string, unknown>;
}

export interface ValidationContext {
  scenario: { id: string } | null;
  links: Array<{
    id: string;
    speedMbps: number;
    status: string;
    sourcePort: { media: string; supportedSpeedsMbps: number[] };
    targetPort: { media: string; supportedSpeedsMbps: number[] };
  }>;
  lags: Array<{
    id: string;
    protocol: string;
    device: { model: { maxLagMembers: number | null; supportsLacp: boolean } };
    members: Array<{ port: { supportedSpeedsMbps: number[] } }>;
  }>;
  memberships: Array<{ id: string; mode: string; allowedVlans: unknown[] }>;
  subnets: Array<{ id: string; cidr: string; vrf: string | null }>;
  devices: Array<{ id: string; hostname: string; placements: unknown[] }>;
  maps: Array<{ id: string; name: string; calibration: unknown | null }>;
}

export interface ModelSwapRepository {
  getSwapContext(
    deviceId: string,
    scenarioId: string,
    targetModelId: string,
  ): Promise<{
    scenario: { isLocked: boolean };
    device: {
      id: string;
      hostname: string;
      modelId: string;
      model: {
        id: string;
        sku: string;
        modelName: string;
        supportsLacp: boolean;
        supportsMlag: boolean;
        supportsStacking: boolean;
        supportsHa: boolean;
      };
      ports: ExistingSwapPort[];
    };
    target: {
      id: string;
      sku: string;
      modelName: string;
      supportsLacp: boolean;
      supportsMlag: boolean;
      supportsStacking: boolean;
      supportsHa: boolean;
      profiles: Parameters<
        typeof import("@/domain/ports/generatePorts").generatePorts
      >[0];
    };
  } | null>;
  commitSwap(
    input: {
      deviceId: string;
      scenarioId: string;
      targetModelId: string;
      targetPorts: GeneratedPort[];
      mappings: PortMapping[];
      unmappedPortIds: string[];
    },
    actor: string,
  ): Promise<void>;
  getValidationContext(scenarioId: string): Promise<ValidationContext>;
  replaceFindings(scenarioId: string, findings: FindingInput[]): Promise<void>;
  listFindings(scenarioId: string): Promise<unknown[]>;
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export class PrismaModelSwapRepository implements ModelSwapRepository {
  private readonly prisma = getPrismaClient();

  async getSwapContext(
    deviceId: string,
    scenarioId: string,
    targetModelId: string,
  ) {
    const [device, target] = await Promise.all([
      this.prisma.deviceInstance.findUnique({
        where: { id_scenarioId: { id: deviceId, scenarioId } },
        include: {
          scenario: { select: { isLocked: true } },
          model: true,
          ports: {
            include: {
              sourceLinks: true,
              targetLinks: true,
              lagMembership: true,
              vlanMembership: true,
            },
            orderBy: { index: "asc" },
          },
        },
      }),
      this.prisma.deviceModel.findUnique({
        where: { id: targetModelId },
        include: {
          portProfiles: {
            orderBy: [{ sortOrder: "asc" }, { portGroup: "asc" }],
          },
        },
      }),
    ]);
    if (!device || !target) return null;
    return {
      scenario: device.scenario,
      device: {
        id: device.id,
        hostname: device.hostname,
        modelId: device.modelId,
        model: device.model,
        ports: device.ports.map((port) => {
          const links = [...port.sourceLinks, ...port.targetLinks];
          return {
            id: port.id,
            name: port.name,
            index: port.index,
            media: port.media,
            supportedSpeedsMbps: port.supportedSpeedsMbps,
            poeStandard: port.poeStandard,
            roleHint: port.roleHint,
            breakoutCapable: port.breakoutCapable,
            connectedSpeedMbps: links.length
              ? Math.max(...links.map((link) => link.speedMbps))
              : null,
            inUse:
              links.length > 0 ||
              Boolean(port.lagMembership) ||
              Boolean(port.vlanMembership),
          };
        }),
      },
      target: {
        id: target.id,
        sku: target.sku,
        modelName: target.modelName,
        supportsLacp: target.supportsLacp,
        supportsMlag: target.supportsMlag,
        supportsStacking: target.supportsStacking,
        supportsHa: target.supportsHa,
        profiles: target.portProfiles,
      },
    };
  }

  async commitSwap(
    input: {
      deviceId: string;
      scenarioId: string;
      targetModelId: string;
      targetPorts: GeneratedPort[];
      mappings: PortMapping[];
      unmappedPortIds: string[];
    },
    actor: string,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.deviceInstance.findUnique({
        where: {
          id_scenarioId: { id: input.deviceId, scenarioId: input.scenarioId },
        },
        include: { ports: true },
      });
      for (const port of before!.ports)
        await tx.port.update({
          where: { id: port.id },
          data: { name: `SWAP-${port.id}` },
        });
      const retained = new Set([
        ...input.mappings.map((mapping) => mapping.sourcePortId),
        ...input.unmappedPortIds,
      ]);
      await tx.port.deleteMany({
        where: {
          deviceInstanceId: input.deviceId,
          scenarioId: input.scenarioId,
          id: { notIn: [...retained] },
        },
      });
      for (const mapping of input.mappings) {
        const target = input.targetPorts.find(
          (port) => port.index === mapping.targetIndex,
        )!;
        await tx.port.update({
          where: { id: mapping.sourcePortId },
          data: target,
        });
      }
      if (input.unmappedPortIds.length) {
        await tx.port.updateMany({
          where: { id: { in: input.unmappedPortIds } },
          data: {
            adminStatus: "DISABLED",
            description:
              "Retained after model swap because connected link could not be mapped.",
          },
        });
        await tx.physicalLink.updateMany({
          where: {
            scenarioId: input.scenarioId,
            OR: [
              { sourcePortId: { in: input.unmappedPortIds } },
              { targetPortId: { in: input.unmappedPortIds } },
            ],
          },
          data: { status: "INVALID" },
        });
      }
      const mappedIndexes = new Set(
        input.mappings.map((mapping) => mapping.targetIndex),
      );
      await tx.port.createMany({
        data: input.targetPorts
          .filter((port) => !mappedIndexes.has(port.index))
          .map((port) => ({
            ...port,
            scenarioId: input.scenarioId,
            deviceInstanceId: input.deviceId,
          })),
      });
      await tx.deviceInstance.update({
        where: {
          id_scenarioId: { id: input.deviceId, scenarioId: input.scenarioId },
        },
        data: { modelId: input.targetModelId },
      });
      await tx.auditLog.create({
        data: {
          scenarioId: input.scenarioId,
          actorId: actor,
          action: "MODEL_SWAP",
          entityType: "DeviceInstance",
          entityId: input.deviceId,
          beforeJson: json(before),
          afterJson: json(input),
        },
      });
    });
  }

  async getValidationContext(scenarioId: string) {
    const [scenario, links, lags, memberships, subnets, devices, maps] =
      await Promise.all([
        this.prisma.scenario.findUnique({
          where: { id: scenarioId },
          select: { id: true },
        }),
        this.prisma.physicalLink.findMany({
          where: { scenarioId },
          include: { sourcePort: true, targetPort: true },
        }),
        this.prisma.lagGroup.findMany({
          where: { scenarioId },
          include: {
            device: { include: { model: true } },
            members: { include: { port: true } },
          },
        }),
        this.prisma.vlanMembership.findMany({
          where: { scenarioId },
          include: { allowedVlans: true },
        }),
        this.prisma.subnet.findMany({ where: { scenarioId } }),
        this.prisma.deviceInstance.findMany({
          where: { scenarioId },
          include: { placements: true },
        }),
        this.prisma.floorMap.findMany({
          where: { scenarioId, isActive: true },
          include: { calibration: true },
        }),
      ]);
    return { scenario, links, lags, memberships, subnets, devices, maps };
  }
  async replaceFindings(scenarioId: string, findings: FindingInput[]) {
    await this.prisma.$transaction(async (tx) => {
      await tx.validationFinding.deleteMany({ where: { scenarioId } });
      if (findings.length)
        await tx.validationFinding.createMany({
          data: findings.map((finding) => ({
            ...finding,
            scenarioId,
            metadataJson: finding.metadataJson
              ? json(finding.metadataJson)
              : undefined,
          })),
        });
    });
  }
  listFindings(scenarioId: string) {
    return this.prisma.validationFinding.findMany({
      where: { scenarioId },
      orderBy: [{ severity: "asc" }, { ruleCode: "asc" }],
    });
  }
}
