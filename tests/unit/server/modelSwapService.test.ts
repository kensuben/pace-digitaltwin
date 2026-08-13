import { describe, expect, it, vi } from "vitest";
import type { ModelSwapRepository } from "@/server/repositories/modelSwapRepository";
import {
  commitModelSwap,
  previewModelSwap,
} from "@/server/services/modelSwapService";

const profile = {
  portGroup: "uplink",
  count: 1,
  media: "SFP28" as const,
  supportedSpeedsMbps: [10000, 25000],
  poeStandard: "NONE" as const,
  roleHint: "UPLINK" as const,
  breakoutCapable: false,
  namePrefix: "SFP",
  startNumber: 1,
  sortOrder: 1,
};
function repository(overrides: Partial<ModelSwapRepository> = {}) {
  return {
    getSwapContext: vi
      .fn()
      .mockResolvedValue({
        scenario: { isLocked: false },
        device: {
          id: "device-1",
          hostname: "CORE-01",
          modelId: "old",
          model: {
            id: "old",
            sku: "OLD",
            modelName: "Old",
            supportsLacp: true,
            supportsMlag: false,
            supportsStacking: false,
            supportsHa: false,
          },
          ports: [
            {
              id: "port-1",
              name: "SFP1",
              index: 1,
              media: "SFP_PLUS",
              supportedSpeedsMbps: [10000],
              poeStandard: "NONE",
              roleHint: "UPLINK",
              breakoutCapable: false,
              connectedSpeedMbps: 10000,
              inUse: true,
            },
          ],
        },
        target: {
          id: "new",
          sku: "NEW",
          modelName: "New",
          supportsLacp: true,
          supportsMlag: false,
          supportsStacking: false,
          supportsHa: false,
          profiles: [profile],
        },
      }),
    commitSwap: vi.fn().mockResolvedValue(undefined),
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
      }),
    replaceFindings: vi.fn(),
    listFindings: vi.fn(),
    ...overrides,
  } as ModelSwapRepository;
}

describe("modelSwapService", () => {
  it("previews compatible mapping without mutation", async () => {
    const repo = repository();
    const result = await previewModelSwap(
      "device-1",
      { scenarioId: "scenario-a", targetModelId: "new" },
      repo,
    );
    expect(result.mapping.mappings).toHaveLength(1);
    expect(repo.commitSwap).not.toHaveBeenCalled();
  });
  it("commits mapping then revalidates the scenario", async () => {
    const repo = repository();
    await commitModelSwap(
      "device-1",
      { scenarioId: "scenario-a", targetModelId: "new" },
      "tester",
      repo,
    );
    expect(repo.commitSwap).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: "device-1", targetModelId: "new" }),
      "tester",
    );
    expect(repo.replaceFindings).toHaveBeenCalled();
  });
  it("blocks findings unless explicitly accepted", async () => {
    const incompatible = repository({
      getSwapContext: vi
        .fn()
        .mockResolvedValue({
          ...(await repository().getSwapContext(
            "device-1",
            "scenario-a",
            "new",
          ))!,
          target: {
            id: "new",
            sku: "NEW",
            modelName: "New",
            supportsLacp: false,
            supportsMlag: false,
            supportsStacking: false,
            supportsHa: false,
            profiles: [{ ...profile, supportedSpeedsMbps: [1000] }],
          },
        }),
    });
    await expect(
      commitModelSwap(
        "device-1",
        { scenarioId: "scenario-a", targetModelId: "new" },
        "tester",
        incompatible,
      ),
    ).rejects.toMatchObject({ code: "MODEL_SWAP_BLOCKED" });
    await expect(
      commitModelSwap(
        "device-1",
        {
          scenarioId: "scenario-a",
          targetModelId: "new",
          commitWithWarnings: true,
        },
        "tester",
        incompatible,
      ),
    ).resolves.toMatchObject({ committed: true });
  });
  it.each([
    ["INVALID_MODEL_SWAP", {}, {}],
    [
      "MODEL_SWAP_NOT_FOUND",
      { scenarioId: "scenario-a", targetModelId: "new" },
      { getSwapContext: vi.fn().mockResolvedValue(null) },
    ],
    [
      "SCENARIO_LOCKED",
      { scenarioId: "scenario-a", targetModelId: "new" },
      {
        getSwapContext: vi
          .fn()
          .mockResolvedValue({
            scenario: { isLocked: true },
            device: { modelId: "old" },
            target: { id: "new" },
          }),
      },
    ],
    [
      "MODEL_UNCHANGED",
      { scenarioId: "scenario-a", targetModelId: "new" },
      {
        getSwapContext: vi
          .fn()
          .mockResolvedValue({
            scenario: { isLocked: false },
            device: { modelId: "new" },
            target: { id: "new" },
          }),
      },
    ],
  ])("returns %s", async (code, input, overrides) => {
    await expect(
      previewModelSwap("device-1", input, repository(overrides)),
    ).rejects.toMatchObject({ code });
  });
});
