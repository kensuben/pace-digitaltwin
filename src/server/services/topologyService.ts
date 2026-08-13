import { z } from "zod";

import { LinkDuplex, LinkStatus, LinkType } from "@/generated/prisma/enums";
import { AppError } from "@/server/errors";
import {
  PrismaTopologyRepository,
  type LinkMutation,
  type TopologyLinkRecord,
  type TopologyRepository,
} from "@/server/repositories/topologyRepository";

export function toTopologyLinkDto(link: TopologyLinkRecord) {
  return {
    id: link.id,
    sourcePortId: link.sourcePortId,
    targetPortId: link.targetPortId,
    sourceDeviceId: link.sourcePort.deviceInstanceId,
    targetDeviceId: link.targetPort.deviceInstanceId,
    linkType: link.linkType,
    speedMbps: link.speedMbps,
    duplex: link.duplex,
    status: link.status,
    cableLabel: link.cableLabel,
    lengthMeters: link.lengthMeters,
  };
}

const optionalLabel = z.string().trim().max(120).optional().nullable();

export const linkMutationSchema = z.object({
  scenarioId: z.string().min(1),
  sourcePortId: z.string().min(1),
  targetPortId: z.string().min(1),
  linkType: z.enum(LinkType),
  speedMbps: z.number().int().positive(),
  duplex: z.enum(LinkDuplex).default("FULL"),
  status: z.enum(LinkStatus).default("PLANNED"),
  cableLabel: optionalLabel,
  lengthMeters: z.number().nonnegative().optional().nullable(),
});

export const positionMutationSchema = z.object({
  positions: z
    .array(
      z.object({
        id: z.string().min(1),
        graphX: z.number().finite(),
        graphY: z.number().finite(),
      }),
    )
    .min(1)
    .max(500),
});

async function assertMutableScenario(
  scenarioId: string,
  repository: TopologyRepository,
) {
  const scenario = await repository.getScenario(scenarioId);
  if (!scenario)
    throw new AppError("SCENARIO_NOT_FOUND", "Scenario was not found.", 404);
  if (scenario.isLocked)
    throw new AppError(
      "SCENARIO_LOCKED",
      "Locked scenarios cannot be changed.",
      409,
    );
}

async function validateLinkPorts(
  input: LinkMutation,
  repository: TopologyRepository,
  excludedLinkId?: string,
) {
  if (input.sourcePortId === input.targetPortId) {
    throw new AppError(
      "SAME_PORT_LINK",
      "A physical link requires two different ports.",
      400,
    );
  }
  const ids = [input.sourcePortId, input.targetPortId];
  const ports = await repository.getPorts(input.scenarioId, ids);
  if (ports.length !== 2)
    throw new AppError(
      "PORT_NOT_FOUND",
      "Both ports must exist in the selected scenario.",
      404,
    );
  if (ports[0]?.deviceInstanceId === ports[1]?.deviceInstanceId)
    throw new AppError(
      "SAME_DEVICE_LINK",
      "A physical link must connect ports on different devices.",
      400,
    );
  if (ports.some((port) => !port.supportedSpeedsMbps.includes(input.speedMbps)))
    throw new AppError(
      "UNSUPPORTED_LINK_SPEED",
      "Link speed must be supported by both ports.",
      400,
    );
  if (await repository.findPortConflict(input.scenarioId, ids, excludedLinkId))
    throw new AppError(
      "PORT_ALREADY_CONNECTED",
      "A selected port already belongs to another physical link.",
      409,
    );
}

export async function getTopology(
  scenarioId: string,
  repository: TopologyRepository = new PrismaTopologyRepository(),
) {
  if (!scenarioId)
    throw new AppError("SCENARIO_REQUIRED", "scenarioId is required.", 400);
  const topology = await repository.getTopology(scenarioId);
  if (!topology.scenario)
    throw new AppError("SCENARIO_NOT_FOUND", "Scenario was not found.", 404);
  return topology;
}

export async function createPhysicalLink(
  input: unknown,
  actorId = "local-admin",
  repository: TopologyRepository = new PrismaTopologyRepository(),
) {
  const parsed = linkMutationSchema.safeParse(input);
  if (!parsed.success)
    throw new AppError(
      "INVALID_LINK",
      parsed.error.issues[0]?.message ?? "Invalid physical link.",
      400,
    );
  await assertMutableScenario(parsed.data.scenarioId, repository);
  await validateLinkPorts(parsed.data, repository);
  return toTopologyLinkDto(await repository.createLink(parsed.data, actorId));
}

export async function updatePhysicalLink(
  scenarioId: string,
  linkId: string,
  input: unknown,
  actorId = "local-admin",
  repository: TopologyRepository = new PrismaTopologyRepository(),
) {
  const parsed = linkMutationSchema.safeParse({
    ...(typeof input === "object" && input ? input : {}),
    scenarioId,
  });
  if (!parsed.success)
    throw new AppError(
      "INVALID_LINK",
      parsed.error.issues[0]?.message ?? "Invalid physical link.",
      400,
    );
  await assertMutableScenario(scenarioId, repository);
  const before = await repository.findLink(scenarioId, linkId);
  if (!before)
    throw new AppError("LINK_NOT_FOUND", "Physical link was not found.", 404);
  await validateLinkPorts(parsed.data, repository, linkId);
  return toTopologyLinkDto(
    await repository.updateLink(linkId, parsed.data, actorId, before),
  );
}

export async function deletePhysicalLink(
  scenarioId: string,
  linkId: string,
  actorId = "local-admin",
  repository: TopologyRepository = new PrismaTopologyRepository(),
) {
  await assertMutableScenario(scenarioId, repository);
  const before = await repository.findLink(scenarioId, linkId);
  if (!before)
    throw new AppError("LINK_NOT_FOUND", "Physical link was not found.", 404);
  await repository.deleteLink(scenarioId, linkId, actorId, before);
}

export async function updateTopologyPositions(
  scenarioId: string,
  input: unknown,
  actorId = "local-admin",
  repository: TopologyRepository = new PrismaTopologyRepository(),
) {
  const parsed = positionMutationSchema.safeParse(input);
  if (!parsed.success)
    throw new AppError(
      "INVALID_POSITIONS",
      parsed.error.issues[0]?.message ?? "Invalid topology positions.",
      400,
    );
  await assertMutableScenario(scenarioId, repository);
  await repository.updatePositions(scenarioId, parsed.data.positions, actorId);
}
