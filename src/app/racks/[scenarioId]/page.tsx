import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { RackDesigner } from "@/components/racks/rack-designer";
import { AppError } from "@/server/errors";
import { getRackRoomDesign } from "@/server/services/rackDesignService";

export const dynamic = "force-dynamic";

export default async function RackDesignPage({ params }: { params: Promise<{ scenarioId: string }> }) {
  const { scenarioId } = await params;
  const design = await getRackRoomDesign(scenarioId).catch((error) => {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  });
  const racks = design.buildings.flatMap((building) => building.floors.flatMap((floor) => floor.zones.flatMap((zone) => zone.racks.map((rack) => ({
    id: rack.id, code: rack.code, name: rack.name, rackUnits: rack.rackUnits, devices: rack.devices.map(toDeviceDto),
  })))));
  return <AppShell><div className="space-y-7">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">B2 · Rack elevation</p><h1 className="mt-2 text-4xl font-bold">{design.scenario.name}</h1><p className="mt-3 max-w-3xl text-muted-foreground">Lắp thiết bị trực quan lên rack theo đơn vị U. Mọi thay đổi được lưu vào inventory của scenario.</p></div><Link className="rounded-xl border bg-card px-4 py-2 text-sm font-bold hover:border-primary" href={`/topology/${scenarioId}`}>Xem topology B2 →</Link></div>
    <RackDesigner scenarioId={scenarioId} isLocked={design.scenario.isLocked} racks={racks} unplacedDevices={design.unplacedDevices.map(toDeviceDto)}/>
  </div></AppShell>;
}

function toDeviceDto(device: {
  id: string; hostname: string; displayName: string; rackId: string | null; rackUnitStart: number | null;
  model: { category: string; rackUnits: number | null; sku: string; modelName: string; vendor: { name: string } };
}) {
  return { id: device.id, hostname: device.hostname, displayName: device.displayName, category: device.model.category, sku: device.model.sku, modelName: device.model.modelName, vendorName: device.model.vendor.name, rackUnits: device.model.rackUnits ?? 1, rackId: device.rackId, rackUnitStart: device.rackUnitStart };
}
