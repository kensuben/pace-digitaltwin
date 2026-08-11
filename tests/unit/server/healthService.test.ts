import { describe, expect, it, vi } from "vitest";

import { getLiveness, getReadiness } from "@/server/services/healthService";

describe("healthService", () => {
  it("reports the process as live", () => {
    expect(getLiveness()).toEqual({
      service: "pace-digitaltwin",
      status: "ok",
    });
  });

  it("reports readiness when PostgreSQL is reachable", async () => {
    const checkConnectivity = vi.fn().mockResolvedValue(undefined);

    await expect(getReadiness({ checkConnectivity })).resolves.toEqual({
      service: "pace-digitaltwin",
      status: "ok",
      checks: { database: "up" },
    });
    expect(checkConnectivity).toHaveBeenCalledOnce();
  });

  it("reports not ready without exposing the database error", async () => {
    const checkConnectivity = vi
      .fn()
      .mockRejectedValue(new Error("secret connection detail"));

    await expect(getReadiness({ checkConnectivity })).resolves.toEqual({
      service: "pace-digitaltwin",
      status: "error",
      checks: { database: "down" },
    });
  });
});
