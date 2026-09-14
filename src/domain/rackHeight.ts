import { AppError } from "@/server/errors";

export function assertRackFits(start: number, height: number, capacity: number, occupants: Array<{
  hostname: string; rackUnitStart: number | null; rackUnitsOverride?: number | null;
  model: { rackUnits: number | null };
}>) {
  const end = start + height - 1;
  if (end > capacity) throw new AppError("RACK_CAPACITY_EXCEEDED", `Thiết bị chiếm U${start}–U${end}, vượt chiều cao rack ${capacity}U.`, 409);
  const collision = occupants.find((item) => item.rackUnitStart !== null &&
    start <= item.rackUnitStart + (item.rackUnitsOverride ?? item.model.rackUnits ?? 1) - 1 && end >= item.rackUnitStart);
  if (collision) throw new AppError("RACK_UNIT_OCCUPIED", `Thiết bị chiếm U${start}–U${end}, chồng vị trí của ${collision.hostname}.`, 409);
}
