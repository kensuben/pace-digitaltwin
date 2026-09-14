import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ disconnect: vi.fn().mockResolvedValue(undefined), created: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: class {} }));
vi.mock("@/generated/prisma/client", () => ({
  Prisma: { DeviceInstanceScalarFieldEnum: { id: "id", rackUnitsOverride: "rackUnitsOverride" } },
  PrismaClient: class { constructor() { mocks.created(); } $disconnect = mocks.disconnect; },
}));

const cache = globalThis as unknown as { prisma?: unknown; prismaSchemaSignature?: string };
afterEach(() => { delete cache.prisma; delete cache.prismaSchemaSignature; vi.unstubAllEnvs(); vi.clearAllMocks(); vi.resetModules(); });

it("replaces an old cached client and reuses the new client", async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("DATABASE_URL", "postgresql://localhost/test");
  const stale = { $disconnect: mocks.disconnect };
  cache.prisma = stale;
  const { getPrismaClient } = await import("@/server/db/client");
  const current = getPrismaClient();
  expect(current).not.toBe(stale);
  expect(mocks.disconnect).toHaveBeenCalledTimes(1);
  expect(getPrismaClient()).toBe(current);
  expect(mocks.created).toHaveBeenCalledTimes(1);
});
