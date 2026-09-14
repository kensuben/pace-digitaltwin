import { describe, expect, it } from "vitest";
import { assertRackFits } from "@/domain/rackHeight";
import { updateDeviceSchema } from "@/server/services/inventoryService";

describe("device rack height", () => {
  it("accepts a per-device height and resetting to model defaults", () => {
    expect(updateDeviceSchema.parse({ rackUnitsOverride: 2 }).rackUnitsOverride).toBe(2);
    expect(updateDeviceSchema.parse({ rackUnitsOverride: null }).rackUnitsOverride).toBeNull();
    for (const value of [0, -1, 1.5]) expect(updateDeviceSchema.safeParse({ rackUnitsOverride: value }).success).toBe(false);
  });
  it("allows a device ending exactly at the last rack unit", () => {
    expect(() => assertRackFits(41, 2, 42, [])).not.toThrow();
    expect(() => assertRackFits(42, 2, 42, [])).toThrow(/vượt chiều cao/);
  });
  it("detects expansion into a neighbour and respects its overridden height", () => {
    const occupants = [{ hostname: "SERVER", rackUnitStart: 33, rackUnitsOverride: 2, model: { rackUnits: 1 } }];
    expect(() => assertRackFits(34, 1, 42, occupants)).toThrow(/SERVER/);
    expect(() => assertRackFits(32, 2, 42, occupants)).toThrow(/SERVER/);
    expect(() => assertRackFits(35, 2, 42, occupants)).not.toThrow();
  });
});
