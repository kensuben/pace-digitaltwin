import { z } from "zod";

import { generatePorts } from "@/domain/ports/generatePorts";
import { autoMapPorts } from "@/domain/ports/modelSwap";
import { AppError } from "@/server/errors";
import {
  PrismaModelSwapRepository,
  type ModelSwapRepository,
} from "@/server/repositories/modelSwapRepository";
import { validateScenario } from "@/server/services/validationService";

const swapSchema = z.object({
  scenarioId: z.string().min(1),
  targetModelId: z.string().min(1),
  commitWithWarnings: z.boolean().default(false),
});

async function buildPreview(
  deviceId: string,
  input: unknown,
  repository: ModelSwapRepository,
) {
  const parsed = swapSchema.safeParse(input);
  if (!parsed.success)
    throw new AppError(
      "INVALID_MODEL_SWAP",
      parsed.error.issues[0]?.message ?? "Invalid model swap.",
      400,
    );
  const context = await repository.getSwapContext(
    deviceId,
    parsed.data.scenarioId,
    parsed.data.targetModelId,
  );
  if (!context)
    throw new AppError(
      "MODEL_SWAP_NOT_FOUND",
      "Device or target model was not found.",
      404,
    );
  if (context.scenario.isLocked)
    throw new AppError(
      "SCENARIO_LOCKED",
      "Locked scenarios cannot be changed.",
      409,
    );
  if (context.device.modelId === context.target.id)
    throw new AppError(
      "MODEL_UNCHANGED",
      "Target model is already assigned.",
      400,
    );
  const targetPorts = generatePorts(context.target.profiles);
  const mapping = autoMapPorts(context.device.ports, targetPorts);
  const findings = [
    ...mapping.unmapped.map((port) => ({
      severity: "ERROR" as const,
      ruleCode: "NET-MODEL-001",
      entityType: "Port",
      entityId: port.id,
      message: `${port.name} has no compatible target port.`,
      remediation:
        "Select another model or remove/reconfigure the affected link.",
    })),
    ...mapping.mappings
      .filter((item) => item.warning)
      .map((item) => ({
        severity: "WARNING" as const,
        ruleCode: "NET-MODEL-002",
        entityType: "Port",
        entityId: item.sourcePortId,
        message: item.warning!,
        remediation: "Confirm the reduced maximum port speed.",
      })),
    ...(context.device.model.supportsLacp && !context.target.supportsLacp
      ? [
          {
            severity: "ERROR" as const,
            ruleCode: "NET-MODEL-003",
            entityType: "DeviceInstance",
            entityId: deviceId,
            message: "Target model does not support LACP.",
            remediation: "Choose an LACP-capable model or remove LACP groups.",
          },
        ]
      : []),
  ];
  return {
    input: parsed.data,
    context,
    targetPorts,
    mapping,
    findings,
    summary: {
      currentModel: context.device.model,
      targetModel: context.target,
      currentPortCount: context.device.ports.length,
      targetPortCount: targetPorts.length,
    },
  };
}

export async function previewModelSwap(
  deviceId: string,
  input: unknown,
  repository: ModelSwapRepository = new PrismaModelSwapRepository(),
) {
  return buildPreview(deviceId, input, repository);
}
export async function commitModelSwap(
  deviceId: string,
  input: unknown,
  actor = "local-admin",
  repository: ModelSwapRepository = new PrismaModelSwapRepository(),
) {
  const preview = await buildPreview(deviceId, input, repository);
  if (
    preview.findings.some((finding) => finding.severity === "ERROR") &&
    !preview.input.commitWithWarnings
  )
    throw new AppError(
      "MODEL_SWAP_BLOCKED",
      "Model swap has blocking findings. Review preview or explicitly commit with warnings.",
      409,
    );
  await repository.commitSwap(
    {
      deviceId,
      scenarioId: preview.input.scenarioId,
      targetModelId: preview.input.targetModelId,
      targetPorts: preview.targetPorts,
      mappings: preview.mapping.mappings,
      unmappedPortIds: preview.mapping.unmapped.map((port) => port.id),
    },
    actor,
  );
  const findings = await validateScenario(preview.input.scenarioId, repository);
  return { committed: true, findings };
}
