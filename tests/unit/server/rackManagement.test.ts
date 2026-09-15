import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ zone: { findFirst: vi.fn() }, rack: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() } }));
vi.mock("@/server/db/client", () => ({ getPrismaClient: () => ({ $transaction: (fn: (tx: typeof mock) => unknown) => fn(mock) }) }));
import { POST } from "@/app/api/racks/route";
beforeEach(() => { vi.resetAllMocks(); mock.zone.findFirst.mockResolvedValue({ id: "zone" }); });
const request = (data: object) => new Request("http://localhost/api/racks", { method: "POST", body: JSON.stringify(data) });
const data = { zoneId: "zone", code: "R02", name: "Rack 02", rackUnits: 42 };
it("creates a rack in a B2 server room", async () => {
  mock.rack.create.mockResolvedValue({ id: "new", ...data });
  expect((await POST(request(data))).status).toBe(200);
  expect(mock.rack.create).toHaveBeenCalledWith({ data });
});
it("rejects shrinking below installed equipment", async () => {
  mock.rack.findUnique.mockResolvedValue({ zoneId: "zone", devices: [{ rackUnitStart: 40, rackUnitsOverride: 2, model: { rackUnits: 1 } }] });
  expect((await POST(request({ ...data, id: "existing", rackUnits: 40 }))).status).toBe(409);
  expect(mock.rack.update).not.toHaveBeenCalled();
});
it("rejects locations outside B2 server rooms", async () => {
  mock.zone.findFirst.mockResolvedValue(null);
  expect((await POST(request(data))).status).toBe(400);
  expect(mock.rack.create).not.toHaveBeenCalled();
});
