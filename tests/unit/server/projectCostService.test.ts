import { describe, expect, it, vi } from "vitest";

import type { ProjectCostRepository } from "@/server/repositories/projectCostRepository";
import { getProjectCostSummary } from "@/server/services/projectCostService";

function repository(data: unknown): ProjectCostRepository {
  return {
    listScenarios: vi.fn().mockResolvedValue([]),
    getScenarioCostData: vi.fn().mockResolvedValue(data),
  };
}

describe("projectCostService", () => {
  it("derives device, fixed-item, VAT and grand totals", async () => {
    const model = {
      id: "model-1",
      sku: "SW-1",
      modelName: "Demo switch",
      category: "ACCESS_SWITCH",
      unitPriceVnd: 10_000_000,
      priceVatRateBps: 800,
      pricingSource: "quote.pdf",
      vendor: { name: "Vendor" },
    };
    const result = await getProjectCostSummary(
      "scenario-1",
      repository({
        id: "scenario-1",
        name: "Proposed",
        type: "PROPOSED",
        devices: [{ model }, { model }],
        costItems: [
          {
            id: "cost-1",
            code: "SUPPORT",
            category: "SOFTWARE",
            description: "Support",
            quantity: 1,
            unitCostVnd: 5_000_000,
            vatRateBps: 0,
            source: "quote.pdf",
          },
        ],
      }),
    );
    expect(result).toMatchObject({
      deviceCount: 2,
      subtotalVnd: 25_000_000,
      vatVnd: 1_600_000,
      totalVnd: 26_600_000,
      unpricedDeviceCount: 0,
    });
  });

  it("reports unpriced devices without inventing a cost", async () => {
    const result = await getProjectCostSummary(
      "scenario-1",
      repository({
        id: "scenario-1",
        name: "Draft",
        type: "PROPOSED",
        devices: [
          {
            model: {
              id: "m",
              sku: "UNKNOWN",
              modelName: "Unknown",
              category: "OTHER",
              unitPriceVnd: null,
              priceVatRateBps: 800,
              pricingSource: null,
              vendor: { name: "Custom" },
            },
          },
        ],
        costItems: [],
      }),
    );
    expect(result).toMatchObject({ totalVnd: 0, unpricedDeviceCount: 1 });
  });

  it("rejects a missing scenario", async () => {
    await expect(
      getProjectCostSummary("missing", repository(null)),
    ).rejects.toMatchObject({ code: "SCENARIO_NOT_FOUND" });
  });
});
