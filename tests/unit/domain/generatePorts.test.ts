import { describe, expect, it } from "vitest";

import {
  generatePorts,
  type PortProfileDefinition,
} from "@/domain/ports/generatePorts";

const profile = (
  overrides: Partial<PortProfileDefinition> = {},
): PortProfileDefinition => ({
  portGroup: "ACCESS",
  count: 2,
  media: "RJ45",
  supportedSpeedsMbps: [1000, 100],
  poeStandard: "NONE",
  roleHint: "DATA",
  breakoutCapable: false,
  namePrefix: "ge",
  startNumber: 1,
  sortOrder: 10,
  ...overrides,
});

describe("generatePorts", () => {
  it("generates stable global indexes in profile order", () => {
    const ports = generatePorts([
      profile({ portGroup: "UPLINK", namePrefix: "x", sortOrder: 20 }),
      profile({ count: 1, sortOrder: 10 }),
    ]);

    expect(ports.map(({ name, index }) => ({ name, index }))).toEqual([
      { name: "ge1", index: 1 },
      { name: "x1", index: 2 },
      { name: "x2", index: 3 },
    ]);
    expect(ports[0]?.supportedSpeedsMbps).toEqual([100, 1000]);
  });

  it("uses the port group as a deterministic tie breaker", () => {
    const ports = generatePorts([
      profile({ portGroup: "B", namePrefix: "b", count: 1 }),
      profile({ portGroup: "A", namePrefix: "a", count: 1 }),
    ]);

    expect(ports.map((port) => port.name)).toEqual(["a1", "b1"]);
  });

  it.each([
    ["zero", { count: 0 }],
    ["fraction", { count: 1.5 }],
    ["negative start", { startNumber: -1 }],
  ])("rejects invalid %s values", (_label, overrides) => {
    expect(() => generatePorts([profile(overrides)])).toThrow(
      /must have a (positive count|non-negative start number)/,
    );
  });

  it("rejects duplicate generated names across groups", () => {
    expect(() =>
      generatePorts([
        profile({ portGroup: "A", count: 1 }),
        profile({ portGroup: "B", count: 1 }),
      ]),
    ).toThrow("Generated duplicate port name: ge1.");
  });
});
