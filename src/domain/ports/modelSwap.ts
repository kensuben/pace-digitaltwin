import type { GeneratedPort } from "@/domain/ports/generatePorts";

export interface ExistingSwapPort extends GeneratedPort {
  id: string;
  connectedSpeedMbps: number | null;
  inUse: boolean;
}

export interface PortMapping {
  sourcePortId: string;
  sourceName: string;
  targetIndex: number;
  targetName: string;
  warning: string | null;
}

function compatible(source: ExistingSwapPort, target: GeneratedPort) {
  if (source.connectedSpeedMbps === null) return true;
  return target.supportedSpeedsMbps.includes(source.connectedSpeedMbps);
}

export function autoMapPorts(
  existing: ExistingSwapPort[],
  targets: GeneratedPort[],
) {
  const available = new Set(targets.map((target) => target.index));
  const mappings: PortMapping[] = [];
  const unmapped: ExistingSwapPort[] = [];

  for (const source of existing) {
    if (!source.inUse) continue;
    const candidates = targets.filter(
      (target) => available.has(target.index) && compatible(source, target),
    );
    const target =
      candidates.find((candidate) => candidate.name === source.name) ??
      candidates.find((candidate) => candidate.media === source.media) ??
      candidates.find((candidate) =>
        candidate.supportedSpeedsMbps.some((speed) =>
          source.supportedSpeedsMbps.includes(speed),
        ),
      );
    if (!target) {
      unmapped.push(source);
      continue;
    }
    available.delete(target.index);
    mappings.push({
      sourcePortId: source.id,
      sourceName: source.name,
      targetIndex: target.index,
      targetName: target.name,
      warning:
        Math.max(...target.supportedSpeedsMbps) <
        Math.max(...source.supportedSpeedsMbps)
          ? "Target port has lower maximum speed."
          : null,
    });
  }
  return {
    mappings,
    unmapped: unmapped.map((port) => ({ id: port.id, name: port.name })),
    unusedTargets: targets.filter((target) => available.has(target.index)),
  };
}
