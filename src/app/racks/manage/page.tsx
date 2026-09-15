import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { RackManagement } from "@/components/racks/rack-management";
import { getPrismaClient } from "@/server/db/client";

export const dynamic = "force-dynamic";
export default async function RackManagementPage() {
  const zones = await getPrismaClient().zone.findMany({ where: { type: "SERVER_ROOM", floor: { code: "B2" } }, include: { floor: { include: { building: true } }, racks: { orderBy: { code: "asc" } } }, orderBy: { code: "asc" } });
  return <AppShell><div className="space-y-7"><Link href="/racks" className="text-primary">← Thiết kế rack</Link><div><h1 className="text-3xl font-bold">Quản lý tủ rack B2</h1><p className="mt-3 text-muted-foreground">Tạo và cập nhật tủ rack trong phòng server. Tủ rack là hạ tầng dùng chung cho các scenario; vị trí thiết bị được lưu riêng theo scenario.</p></div><RackManagement zones={zones.map((zone) => ({ id: zone.id, label: `${zone.floor.building.code} / ${zone.floor.code} / ${zone.code}` }))} racks={zones.flatMap((zone) => zone.racks.map((rack) => ({ id: rack.id, zoneId: rack.zoneId, code: rack.code, name: rack.name, rackUnits: rack.rackUnits })))}/></div></AppShell>;
}
