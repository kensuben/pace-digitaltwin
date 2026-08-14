import { describe, expect, it } from "vitest";
import { calculateNetworkStructureData } from "@/server/services/networkStructureService";

describe("calculateNetworkStructureData", () => {
  it("creates floor VLANs and reports physical readiness", () => {
    const devices = [
      { id: "core", floor: { id: "b2", code: "B2", name: "Basement 2", level: -2 } },
      { id: "sw", floor: { id: "f1", code: "F1", name: "Floor 1", level: 1 } },
      { id: "ap", floor: { id: "f1", code: "F1", name: "Floor 1", level: 1 } },
    ];
    const links = [{ sourcePort: { deviceInstanceId: "core" }, targetPort: { deviceInstanceId: "sw" } }];
    const result = calculateNetworkStructureData(devices as never, links);
    expect(result.readinessScore).toBe(67);
    expect(result.summary.unconnectedDevices).toBe(1);
    expect(result.vlans).toContainEqual(expect.objectContaining({ vlanId: 100, name: "USER-F1", cidr: "10.181.100.0/24" }));
  });
});
