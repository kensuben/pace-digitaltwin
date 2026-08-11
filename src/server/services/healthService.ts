import type { HealthRepository } from "@/server/repositories/healthRepository";

export interface HealthReport {
  status: "ok" | "error";
  service: "pace-digitaltwin";
  checks?: {
    database: "up" | "down";
  };
}

const baseReport = {
  service: "pace-digitaltwin",
} as const;

export function getLiveness(): HealthReport {
  return {
    ...baseReport,
    status: "ok",
  };
}

export async function getReadiness(
  repository: HealthRepository,
): Promise<HealthReport> {
  try {
    await repository.checkConnectivity();
    return {
      ...baseReport,
      status: "ok",
      checks: { database: "up" },
    };
  } catch {
    return {
      ...baseReport,
      status: "error",
      checks: { database: "down" },
    };
  }
}
