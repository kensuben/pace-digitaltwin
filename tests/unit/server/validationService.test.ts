import { describe, expect, it, vi } from "vitest";
import type {
  ModelSwapRepository,
  ValidationContext,
} from "@/server/repositories/modelSwapRepository";
import {
  listValidationFindings,
  validateScenario,
} from "@/server/services/validationService";
function repository(context: Partial<ValidationContext> = {}) {
  return {
    getValidationContext: vi
      .fn()
      .mockResolvedValue({
        scenario: { id: "scenario-a" },
        links: [],
        lags: [],
        memberships: [],
        subnets: [],
        devices: [],
        maps: [],
        ...context,
      }),
    replaceFindings: vi.fn().mockResolvedValue(undefined),
    listFindings: vi.fn().mockResolvedValue([{ id: "finding-1" }]),
  } as unknown as ModelSwapRepository;
}
describe("validationService", () => {
  it("evaluates network and spatial rules then persists findings", async () => {
    const repo = repository({
      links: [
        {
          id: "link-1",
          speedMbps: 25000,
          status: "INVALID",
          sourcePort: { media: "SFP_PLUS", supportedSpeedsMbps: [10000] },
          targetPort: { media: "RJ45", supportedSpeedsMbps: [1000] },
        },
      ],
      lags: [
        {
          id: "lag-1",
          protocol: "LACP",
          device: { model: { maxLagMembers: 1, supportsLacp: false } },
          members: [
            { port: { supportedSpeedsMbps: [1000] } },
            { port: { supportedSpeedsMbps: [10000] } },
          ],
        },
      ],
      memberships: [{ id: "membership-1", mode: "ACCESS", allowedVlans: [] }],
      subnets: [
        { id: "subnet-1", cidr: "10.0.0.0/24", vrf: null },
        { id: "subnet-2", cidr: "10.0.0.128/25", vrf: null },
      ],
      devices: [{ id: "device-1", hostname: "CORE-01", placements: [] }],
      maps: [{ id: "map-1", name: "Floor", calibration: null }],
    });
    const findings = await validateScenario("scenario-a", repo);
    expect(findings.map((finding) => finding.ruleCode)).toEqual(
      expect.arrayContaining([
        "NET-PORT-001",
        "NET-PORT-002",
        "NET-MODEL-001",
        "NET-LAG-001",
        "NET-LAG-002",
        "NET-LAG-003",
        "NET-VLAN-001",
        "NET-IP-001",
        "SPATIAL-001",
        "SPATIAL-009",
      ]),
    );
    expect(repo.replaceFindings).toHaveBeenCalledWith("scenario-a", findings);
  });
  it("returns no findings for valid entities", async () => {
    await expect(
      validateScenario(
        "scenario-a",
        repository({
          devices: [{ id: "d", hostname: "D", placements: [{}] }],
          maps: [{ id: "m", name: "M", calibration: {} }],
        }),
      ),
    ).resolves.toEqual([]);
  });
  it("lists persisted findings and validates identifiers", async () => {
    await expect(
      listValidationFindings("scenario-a", repository()),
    ).resolves.toEqual([{ id: "finding-1" }]);
    await expect(
      listValidationFindings("", repository()),
    ).rejects.toMatchObject({ code: "SCENARIO_REQUIRED" });
    await expect(
      validateScenario("missing", repository({ scenario: null })),
    ).rejects.toMatchObject({ code: "SCENARIO_NOT_FOUND" });
  });
});
