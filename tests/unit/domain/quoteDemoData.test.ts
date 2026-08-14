import { describe, expect, it } from "vitest";

import {
  netgearDemoDevices,
  quoteModels,
} from "../../../prisma/quote-demo-data";
import { generatePorts } from "@/domain/ports/generatePorts";

describe("quotation demo data", () => {
  it("includes every managed model missing from the three quotations", () => {
    expect(quoteModels.map((model) => model.sku)).toEqual(
      expect.arrayContaining([
        "GS728TXv3",
        "GS752TXv3",
        "CRS326-24G-2S+RM",
        "CRS354-48G-4S+2Q+RM",
        "IS230-10TP-AC",
        "C1300-24T-4X",
        "C1300-48T-4X",
        "C1300-16T-2G",
        "C1300-16P-4X",
        "U7-Pro",
      ]),
    );
    for (const model of quoteModels) {
      expect(() => generatePorts(model.profiles)).not.toThrow();
      expect(model.unitPriceVnd).toBeGreaterThan(0);
    }
    expect(
      quoteModels.find((model) => model.sku === "U7-Pro")?.rackUnits,
    ).toBeNull();
  });

  it("builds the latest Netgear quote as a 50-device proposed demo", () => {
    expect(netgearDemoDevices).toHaveLength(50);
    expect(
      new Set(netgearDemoDevices.map((device) => device.hostname)).size,
    ).toBe(50);
    expect(
      netgearDemoDevices.filter((device) => device.sku === "U7-Pro"),
    ).toHaveLength(24);
    expect(
      netgearDemoDevices.every(
        (device) =>
          device.floorCode === "B2" ||
          /^T(?:[1-9]|1[01])$/.test(device.floorCode),
      ),
    ).toBe(true);
  });
});
