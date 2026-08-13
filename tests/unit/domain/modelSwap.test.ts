import { describe, expect, it } from "vitest";
import { autoMapPorts, type ExistingSwapPort } from "@/domain/ports/modelSwap";
import type { GeneratedPort } from "@/domain/ports/generatePorts";

function port(overrides: Partial<ExistingSwapPort> = {}): ExistingSwapPort {
  return {
    id: "old-1",
    name: "SFP1",
    index: 1,
    media: "SFP_PLUS",
    supportedSpeedsMbps: [1000, 10000],
    poeStandard: "NONE",
    roleHint: "UPLINK",
    breakoutCapable: false,
    connectedSpeedMbps: 10000,
    inUse: true,
    ...overrides,
  };
}
function target(overrides: Partial<GeneratedPort> = {}): GeneratedPort {
  return {
    name: "SFP1",
    index: 1,
    media: "SFP28",
    supportedSpeedsMbps: [10000, 25000],
    poeStandard: "NONE",
    roleHint: "UPLINK",
    breakoutCapable: false,
    ...overrides,
  };
}

describe("model swap port mapping", () => {
  it("prioritizes compatible same-name ports and preserves source IDs", () => {
    const result = autoMapPorts([port()], [target()]);
    expect(result.mappings[0]).toMatchObject({
      sourcePortId: "old-1",
      targetName: "SFP1",
    });
    expect(result.unmapped).toEqual([]);
  });
  it("falls back to same media and leaves unused target capacity", () => {
    const result = autoMapPorts(
      [port({ name: "OLD" })],
      [
        target({ name: "NEW", media: "SFP_PLUS" }),
        target({ name: "FREE", index: 2 }),
      ],
    );
    expect(result.mappings[0]?.targetName).toBe("NEW");
    expect(result.unusedTargets).toHaveLength(1);
  });
  it("reports connected ports without a compatible speed", () => {
    const result = autoMapPorts(
      [port({ connectedSpeedMbps: 25000 })],
      [target({ supportedSpeedsMbps: [10000] })],
    );
    expect(result.unmapped).toEqual([{ id: "old-1", name: "SFP1" }]);
  });
  it("does not consume target ports for unused source ports", () => {
    const result = autoMapPorts(
      [port({ inUse: false, connectedSpeedMbps: null })],
      [target()],
    );
    expect(result.mappings).toEqual([]);
    expect(result.unusedTargets).toHaveLength(1);
  });
  it("warns when target maximum speed is lower", () => {
    const result = autoMapPorts(
      [
        port({
          supportedSpeedsMbps: [10000, 25000],
          connectedSpeedMbps: 10000,
        }),
      ],
      [target({ supportedSpeedsMbps: [10000] })],
    );
    expect(result.mappings[0]?.warning).toContain("lower");
  });
});
