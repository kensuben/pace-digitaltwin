import { describe, expect, it } from "vitest";
import type { ScenarioAnalysisRecord } from "@/server/repositories/scenarioRepository";
import { compareScenarioData, simulateFailureData } from "@/server/services/scenarioService";

function scenario(input: {
  id: string;
  name: string;
  devices: Array<{ id: string; hostname: string; category: string; sku?: string; price?: number }>;
  links?: Array<{ id: string; source: string; target: string; speed: number }>;
}): ScenarioAnalysisRecord {
  const deviceRecords = input.devices.map((device) => ({
    id: device.id, hostname: device.hostname, modelId: device.sku ?? device.category,
    model: { sku: device.sku ?? device.category, modelName: device.sku ?? device.category,
      category: device.category, unitPriceVnd: device.price ?? null, priceVatRateBps: 0,
      vendor: { name: "Test" } }, ports: [],
  }));
  const byId = new Map(deviceRecords.map((device) => [device.id, device]));
  return {
    id: input.id, name: input.name, devices: deviceRecords,
    physicalLinks: (input.links ?? []).map((link) => ({
      id: link.id, speedMbps: link.speed, status: "ACTIVE",
      sourcePort: { name: "p1", deviceInstanceId: link.source, device: byId.get(link.source)! },
      targetPort: { name: "p1", deviceInstanceId: link.target, device: byId.get(link.target)! },
    })),
    validationFindings: [], costItems: [],
  } as unknown as ScenarioAnalysisRecord;
}

describe("scenarioService", () => {
  it("reports model replacement and cost delta by stable hostname", () => {
    const left = scenario({ id: "a", name: "Baseline", devices: [{ id: "a1", hostname: "core-01", category: "CORE_SWITCH", sku: "OLD", price: 100 }] });
    const right = scenario({ id: "b", name: "Option", devices: [{ id: "b1", hostname: "core-01", category: "CORE_SWITCH", sku: "NEW", price: 150 }] });
    const result = compareScenarioData(left, right);
    expect(result.deviceChanges.replaced).toEqual([{ hostname: "core-01", from: "OLD", to: "NEW" }]);
    expect(result.costDeltaVnd).toBe(50);
  });

  it("finds devices disconnected from the core after a link failure", () => {
    const data = scenario({ id: "a", name: "Option", devices: [
      { id: "core", hostname: "core-01", category: "CORE_SWITCH" },
      { id: "access", hostname: "access-01", category: "ACCESS_SWITCH" },
      { id: "ap", hostname: "ap-01", category: "AP" },
    ], links: [
      { id: "uplink", source: "core", target: "access", speed: 10_000 },
      { id: "edge", source: "access", target: "ap", speed: 1_000 },
    ] });
    const result = simulateFailureData(data, [], ["uplink"]);
    expect(result.riskLevel).toBe("HIGH");
    expect(result.impactedDevices.map((device) => device.hostname)).toEqual(["access-01", "ap-01"]);
    expect(result.availableCapacityMbps).toBe(1_000);
  });

  it("marks a simulation critical when every root fails", () => {
    const data = scenario({ id: "a", name: "Option", devices: [
      { id: "fw", hostname: "fw-01", category: "FIREWALL" },
      { id: "access", hostname: "access-01", category: "ACCESS_SWITCH" },
    ], links: [{ id: "wan", source: "fw", target: "access", speed: 1_000 }] });
    expect(simulateFailureData(data, ["fw"], []).riskLevel).toBe("CRITICAL");
  });

  it("rejects targets outside the selected scenario", () => {
    const data = scenario({ id: "a", name: "Option", devices: [] });
    expect(() => simulateFailureData(data, ["other"], [])).toThrow("does not belong");
  });
});
