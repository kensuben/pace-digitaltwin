"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Server, X } from "lucide-react";
import type { InventoryDetailRecord } from "@/server/repositories/inventoryRepository";
import type { VirtualMachineDto } from "./virtual-machine-manager";

export function DeviceDetailsPanel({ deviceId, scenarioId, rackLabel, virtualMachines, onClose, onManageVms }: {
  deviceId: string; scenarioId: string; rackLabel: string; virtualMachines: VirtualMachineDto[];
  onClose: () => void; onManageVms: () => void;
}) {
  const [device, setDevice] = useState<InventoryDetailRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/inventory/${encodeURIComponent(deviceId)}?scenarioId=${encodeURIComponent(scenarioId)}`, { signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.errors?.[0]?.message ?? "Không thể tải thông tin thiết bị.");
        if (!controller.signal.aborted) setDevice(payload.data);
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Không thể tải thông tin thiết bị.");
      }
    }
    void load();
    return () => controller.abort();
  }, [deviceId, scenarioId, attempt]);

  return <aside aria-label="Thông tin thiết bị" className="min-w-0 rounded-2xl border bg-card shadow-sm xl:sticky xl:top-28 xl:max-h-[calc(100dvh-8rem)] xl:overflow-y-auto">
    <header className="flex items-center justify-between gap-3 border-b p-4">
      <h2 className="flex items-center gap-2 font-bold"><Server size={18} className="text-primary"/>Thông tin thiết bị</h2>
      <button type="button" aria-label="Đóng thông tin thiết bị" onClick={onClose} className="rounded-lg p-2 hover:bg-accent"><X size={18}/></button>
    </header>
    {!device && !error && <p role="status" className="p-5 text-sm text-muted-foreground">Đang tải cấu hình thiết bị…</p>}
    {error && <div role="alert" className="space-y-3 p-4 text-sm"><p className="text-destructive">{error}</p><button type="button" className="rounded-lg border px-3 py-2" onClick={() => { setError(null); setAttempt((value) => value + 1); }}>Thử lại</button></div>}
    {device && <div className="space-y-5 p-4 text-sm">
      <div><h3 className="break-words text-lg font-bold text-primary">{device.hostname}</h3><p className="break-words text-muted-foreground">{device.displayName}</p></div>
      <dl className="grid grid-cols-2 gap-3">
        <Field label="Hãng" value={device.model.vendor.name}/><Field label="Loại thiết bị" value={device.model.category}/>
        <Field label="Model" value={device.model.modelName}/><Field label="SKU" value={device.model.sku}/>
        <Field label="Trạng thái" value={device.status}/><Field label="IP quản trị" value={device.managementIp}/>
        <Field label="Asset tag" value={device.assetTag}/><Field label="Serial" value={device.serialNumber}/>
        <Field label="Vị trí rack" value={rackLabel}/><Field label="Chiều cao" value={`${device.model.rackUnits ?? 1}U`}/>
      </dl>
      <section className="space-y-2 border-t pt-4"><h3 className="font-bold">Cổng & kết nối ({device.ports.length})</h3>
        {device.ports.length === 0 && <p className="text-muted-foreground">Chưa khai báo cổng.</p>}
        <div className="max-h-72 space-y-2 overflow-y-auto">{device.ports.map((port) => <div key={port.id} className="rounded-lg border p-3">
          <div className="flex flex-wrap justify-between gap-1"><span className="font-semibold">{port.name}</span><span className="text-xs text-muted-foreground">{port.media}</span></div>
          <p className="text-xs text-muted-foreground">{port.supportedSpeedsMbps.length ? `${port.supportedSpeedsMbps.join(" / ")} Mbps` : "Chưa khai báo tốc độ"}</p>
          <p className="mt-1 text-xs">Admin: {port.adminStatus} · Operational: {port.operationalStatus}</p>
          {port.sourceLinks.map((link) => <p key={link.id} className="mt-1 break-words text-xs text-primary">→ {link.targetPort.device.hostname} / {link.targetPort.name} · {link.speedMbps} Mbps · {link.status}</p>)}
          {port.targetLinks.map((link) => <p key={link.id} className="mt-1 break-words text-xs text-primary">→ {link.sourcePort.device.hostname} / {link.sourcePort.name} · {link.speedMbps} Mbps · {link.status}</p>)}
        </div>)}</div>
      </section>
      {device.model.category === "SERVER" && <section className="space-y-2 border-t pt-4"><h3 className="font-bold">Virtual Machines ({virtualMachines.length})</h3>
        {virtualMachines.length === 0 && <p className="text-muted-foreground">Chưa khai báo máy ảo.</p>}
        {virtualMachines.map((vm) => <div key={vm.id} className="rounded-lg border p-3"><p className="break-words font-semibold">{vm.hostname}</p><p className="text-xs text-muted-foreground">{vm.operatingSystem ?? "Chưa khai báo OS"} · {vm.status}</p><p className="text-xs">{vm.vcpuCount} vCPU · {vm.memoryMb} MB RAM · {vm.storageGb} GB</p><p className="text-xs">IP: {vm.ipAddress ?? "—"}</p></div>)}
        <button type="button" onClick={onManageVms} className="rounded-lg border px-3 py-2 font-semibold text-primary hover:bg-accent">Xem / quản lý VM</button>
      </section>}
      {device.notes && <section className="border-t pt-4"><h3 className="font-bold">Ghi chú</h3><p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">{device.notes}</p></section>}
      <Link href={`/inventory/${encodeURIComponent(deviceId)}?scenarioId=${encodeURIComponent(scenarioId)}`} className="block rounded-xl border p-3 text-center font-semibold text-primary hover:bg-accent">Mở chi tiết Inventory →</Link>
    </div>}
  </aside>;
}

function Field({ label, value }: { label: string; value: string | null }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words">{value || "—"}</dd></div>;
}
