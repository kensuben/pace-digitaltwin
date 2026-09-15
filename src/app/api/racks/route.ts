import { z } from "zod";
import { getPrismaClient } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { apiSuccess, apiError } from "@/server/http/apiResponse";

const schema = z.object({ id: z.string().min(1).optional(), zoneId: z.string().min(1), code: z.string().trim().min(1).max(80), name: z.string().trim().min(1).max(160), rackUnits: z.number().int().min(1).max(100) });

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AppError("INVALID_RACK", "Nhập mã, tên, phòng server và chiều cao từ 1–100U.", 400);
    const { id, ...data } = parsed.data;
    const prisma = getPrismaClient();
    const rack = await prisma.$transaction(async (tx) => {
      const zone = await tx.zone.findFirst({ where: { id: data.zoneId, type: "SERVER_ROOM", floor: { code: "B2" } } });
      if (!zone) throw new AppError("INVALID_ZONE", "Chọn phòng server tại B2.", 400);
      if (id) {
        const existing = await tx.rack.findUnique({ where: { id }, include: { devices: { include: { model: true } }, placements: true } });
        if (!existing) throw new AppError("RACK_NOT_FOUND", "Không tìm thấy tủ rack.", 404);
        if (existing.zoneId !== data.zoneId) throw new AppError("RACK_ZONE_CHANGE", "Không thể đổi phòng của tủ rack đã tạo.", 409);
        if (existing.devices.some((device) => device.rackUnitStart !== null && device.rackUnitStart + (device.rackUnitsOverride ?? device.model.rackUnits ?? 1) - 1 > data.rackUnits))
          throw new AppError("RACK_CAPACITY", "Chiều cao mới không đủ cho thiết bị đang lắp trong một scenario.", 409);
        return tx.rack.update({ where: { id }, data });
      }
      return tx.rack.create({ data });
    });
    return apiSuccess(rack);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return apiError(new AppError("RACK_CODE_EXISTS", "Mã tủ rack đã tồn tại trong phòng này.", 409));
    return apiError(error);
  }
}
