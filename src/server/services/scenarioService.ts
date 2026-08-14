import { z } from "zod";
import { AppError } from "@/server/errors";
import { PrismaScenarioRepository, type ScenarioAnalysisRecord, type ScenarioRepository } from "@/server/repositories/scenarioRepository";

const cloneSchema = z.object({ name: z.string().trim().min(3).max(100) });
const failureSchema = z.object({
  scenarioId: z.string().min(1),
  failedDeviceIds: z.array(z.string()).default([]),
  failedLinkIds: z.array(z.string()).default([]),
});

export const listScenarios = (repository: ScenarioRepository = new PrismaScenarioRepository()) => repository.list();

export async function getScenarioDesignContext(id: string, repository: ScenarioRepository = new PrismaScenarioRepository()) {
  if (!id) throw new AppError("SCENARIO_REQUIRED", "scenarioId is required.", 400);
  if (!repository.getDesignContext) throw new AppError("DESIGN_CONTEXT_UNAVAILABLE", "Design context is unavailable.", 503);
  const context = await repository.getDesignContext(id);
  if (!context) throw new AppError("SCENARIO_NOT_FOUND", "Scenario was not found.", 404);
  return context;
}

export async function cloneScenario(sourceId: string, input: unknown, repository: ScenarioRepository = new PrismaScenarioRepository()) {
  const parsed = cloneSchema.safeParse(input);
  if (!parsed.success) throw new AppError("INVALID_SCENARIO", parsed.error.issues[0]?.message ?? "Invalid scenario.", 400);
  try { return await repository.clone(sourceId, parsed.data.name, "demo-user"); }
  catch (error) {
    if (error instanceof Error && error.message === "SCENARIO_NOT_FOUND") throw new AppError("SCENARIO_NOT_FOUND", "Scenario was not found.", 404);
    throw error;
  }
}

function linkKey(link: ScenarioAnalysisRecord["physicalLinks"][number]) {
  const ends = [`${link.sourcePort.device.hostname}:${link.sourcePort.name}`, `${link.targetPort.device.hostname}:${link.targetPort.name}`].sort();
  return `${ends.join(" ↔ ")} · ${link.speedMbps} Mbps`;
}

export function compareScenarioData(left: ScenarioAnalysisRecord, right: ScenarioAnalysisRecord) {
  const leftDevices = new Map(left.devices.map((d) => [d.hostname, d]));
  const rightDevices = new Map(right.devices.map((d) => [d.hostname, d]));
  const added = right.devices.filter((d) => !leftDevices.has(d.hostname)).map((d) => `${d.hostname} · ${d.model.vendor.name} ${d.model.modelName}`);
  const removed = left.devices.filter((d) => !rightDevices.has(d.hostname)).map((d) => `${d.hostname} · ${d.model.vendor.name} ${d.model.modelName}`);
  const replaced = right.devices.flatMap((device) => {
    const previous = leftDevices.get(device.hostname);
    return previous && previous.modelId !== device.modelId ? [{ hostname: device.hostname, from: previous.model.sku, to: device.model.sku }] : [];
  });
  const leftLinks = new Set(left.physicalLinks.map(linkKey));
  const rightLinks = new Set(right.physicalLinks.map(linkKey));
  const cost = (scenario: ScenarioAnalysisRecord) => scenario.devices.reduce((sum, d) => sum + (d.model.unitPriceVnd ?? 0) * (1 + d.model.priceVatRateBps / 10_000), 0)
    + scenario.costItems.reduce((sum, i) => sum + i.quantity * i.unitCostVnd * (1 + i.vatRateBps / 10_000), 0);
  const severities = (scenario: ScenarioAnalysisRecord) => scenario.validationFindings.reduce<Record<string, number>>((out, finding) => ({ ...out, [finding.severity]: (out[finding.severity] ?? 0) + 1 }), {});
  const leftCost = Math.round(cost(left)); const rightCost = Math.round(cost(right));
  return {
    left: { id: left.id, name: left.name, deviceCount: left.devices.length, linkCount: left.physicalLinks.length, totalCostVnd: leftCost, findings: severities(left) },
    right: { id: right.id, name: right.name, deviceCount: right.devices.length, linkCount: right.physicalLinks.length, totalCostVnd: rightCost, findings: severities(right) },
    deviceChanges: { added, removed, replaced },
    linkChanges: { added: [...rightLinks].filter((key) => !leftLinks.has(key)), removed: [...leftLinks].filter((key) => !rightLinks.has(key)) },
    costDeltaVnd: rightCost - leftCost,
  };
}

export async function compareScenarios(leftId: string, rightId: string, repository: ScenarioRepository = new PrismaScenarioRepository()) {
  if (!leftId || !rightId) throw new AppError("SCENARIOS_REQUIRED", "leftId and rightId are required.", 400);
  const [left, right] = await Promise.all([repository.getAnalysis(leftId), repository.getAnalysis(rightId)]);
  if (!left || !right) throw new AppError("SCENARIO_NOT_FOUND", "One or both scenarios were not found.", 404);
  return compareScenarioData(left, right);
}

export function simulateFailureData(scenario: ScenarioAnalysisRecord, failedDeviceIds: string[], failedLinkIds: string[]) {
  const deviceIds = new Set(scenario.devices.map((d) => d.id));
  const linkIds = new Set(scenario.physicalLinks.map((l) => l.id));
  if (failedDeviceIds.some((id) => !deviceIds.has(id)) || failedLinkIds.some((id) => !linkIds.has(id))) throw new AppError("INVALID_FAILURE_TARGET", "A failure target does not belong to this scenario.", 400);
  const failedDevices = new Set(failedDeviceIds); const failedLinks = new Set(failedLinkIds);
  const adjacency = new Map(scenario.devices.map((d) => [d.id, new Set<string>()]));
  for (const link of scenario.physicalLinks) {
    const a = link.sourcePort.deviceInstanceId; const b = link.targetPort.deviceInstanceId;
    if (!failedLinks.has(link.id) && !failedDevices.has(a) && !failedDevices.has(b) && link.status !== "INACTIVE") { adjacency.get(a)?.add(b); adjacency.get(b)?.add(a); }
  }
  const roots = scenario.devices.filter((d) => !failedDevices.has(d.id) && ["CORE_SWITCH", "FIREWALL", "ISP_CPE"].includes(d.model.category)).map((d) => d.id);
  const reachable = new Set(roots); const queue = [...roots];
  while (queue.length) for (const next of adjacency.get(queue.shift()!) ?? []) if (!reachable.has(next)) { reachable.add(next); queue.push(next); }
  const impactedDevices = scenario.devices.filter((d) => failedDevices.has(d.id) || !reachable.has(d.id)).map((d) => ({ id: d.id, hostname: d.hostname, reason: failedDevices.has(d.id) ? "FAILED" : "NO_PATH_TO_CORE" }));
  const originalCapacityMbps = scenario.physicalLinks.filter((l) => l.status !== "INACTIVE").reduce((sum, l) => sum + l.speedMbps, 0);
  const availableCapacityMbps = scenario.physicalLinks.filter((l) => !failedLinks.has(l.id) && !failedDevices.has(l.sourcePort.deviceInstanceId) && !failedDevices.has(l.targetPort.deviceInstanceId) && l.status !== "INACTIVE").reduce((sum, l) => sum + l.speedMbps, 0);
  return { scenario: { id: scenario.id, name: scenario.name }, riskLevel: roots.length === 0 ? "CRITICAL" : impactedDevices.length ? "HIGH" : failedDeviceIds.length || failedLinkIds.length ? "MEDIUM" : "LOW", failedDeviceCount: failedDevices.size, failedLinkCount: failedLinks.size, impactedDeviceCount: impactedDevices.length, impactedDevices, originalCapacityMbps, availableCapacityMbps, capacityDeltaMbps: availableCapacityMbps - originalCapacityMbps };
}

export async function simulateFailure(input: unknown, repository: ScenarioRepository = new PrismaScenarioRepository()) {
  const parsed = failureSchema.safeParse(input);
  if (!parsed.success) throw new AppError("INVALID_FAILURE_SIMULATION", parsed.error.issues[0]?.message ?? "Invalid simulation.", 400);
  const scenario = await repository.getAnalysis(parsed.data.scenarioId);
  if (!scenario) throw new AppError("SCENARIO_NOT_FOUND", "Scenario was not found.", 404);
  return simulateFailureData(scenario, parsed.data.failedDeviceIds, parsed.data.failedLinkIds);
}
