"use client";

import { Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { LocationOption } from "@/components/inventory/create-device-form";
import { DeviceStatus } from "@/generated/prisma/enums";

export type EditableInventoryDevice = {
  id: string; scenarioId: string; hostname: string; displayName: string;
  assetTag: string | null; serialNumber: string | null; managementIp: string | null;
  status: string; rackUnitStart: number | null; notes: string | null;
  rackUnitsOverride: number | null; modelRackUnits: number | null;
  unitPriceOverrideVnd: number | null; priceVatRateOverrideBps: number | null;
  pricingSourceOverride: string | null; currentLocationKey: string;
  modelName: string; modelSku: string; modelUnitPriceVnd: number | null;
  modelVatRateBps: number; locked: boolean;
};

export function EditInventoryButton({ device, locations, compact = false }: {
  device: EditableInventoryDevice; locations: LocationOption[]; compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [locationKey, setLocationKey] = useState(device.currentLocationKey);
  const selectedLocation = locations.find((location) => location.key === locationKey);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLocation) { setError("Location không hợp lệ."); return; }
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const optionalNumber = (name: string) => form.get(name) === "" ? null : Number(form.get(name));
    const response = await fetch(`/api/inventory/${encodeURIComponent(device.id)}?scenarioId=${encodeURIComponent(device.scenarioId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hostname: form.get("hostname"), displayName: form.get("displayName"),
        assetTag: form.get("assetTag") || null, serialNumber: form.get("serialNumber") || null,
        managementIp: form.get("managementIp") || null, status: form.get("status"),
        buildingId: selectedLocation.buildingId, floorId: selectedLocation.floorId,
        zoneId: selectedLocation.zoneId, rackId: selectedLocation.rackId,
        rackUnitStart: selectedLocation.rackId ? optionalNumber("rackUnitStart") : null,
        rackUnitsOverride: optionalNumber("rackUnitsOverride"),
        unitPriceOverrideVnd: optionalNumber("unitPriceOverrideVnd"),
        priceVatRateOverrideBps: form.get("vatPercent") === "" ? null : Math.round(Number(form.get("vatPercent")) * 100),
        pricingSourceOverride: form.get("pricingSourceOverride") || null,
        notes: form.get("notes") || null,
      }),
    });
    const result = (await response.json()) as { errors?: Array<{ message: string }> };
    setBusy(false);
    if (!response.ok) { setError(result.errors?.[0]?.message ?? "Không thể cập nhật thiết bị."); return; }
    setOpen(false);
    router.refresh();
  }

  if (device.locked) return null;
  return <>
    <button aria-label={`Edit ${device.hostname}`} className={compact ? "inline-flex min-h-9 items-center gap-1 rounded-lg border px-2.5 text-xs font-bold text-primary hover:bg-primary/10" : "grid size-9 place-items-center rounded-lg border text-muted-foreground transition hover:border-primary/40 hover:bg-primary/10 hover:text-primary"} onClick={() => { setLocationKey(device.currentLocationKey); setError(""); setOpen(true); }} title="Edit device" type="button"><Pencil size={14}/>{compact && "Edit"}</button>
    {open && <div aria-labelledby="edit-inventory-title" aria-modal="true" className="fixed inset-0 z-[70] grid place-items-center bg-black/75 p-3 backdrop-blur-sm sm:p-6" role="dialog" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b p-4 sm:p-6"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{device.modelName} · {device.modelSku}</p><h2 className="mt-1 text-2xl font-bold" id="edit-inventory-title">Cập nhật thiết bị · {device.hostname}</h2><p className="mt-1 text-sm text-muted-foreground">Cập nhật định danh, trạng thái, vị trí và thông tin giá của instance.</p></div><button aria-label="Đóng" className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground hover:text-foreground" onClick={() => setOpen(false)} type="button"><X size={19}/></button></header>
        <form className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Hostname"><input autoFocus className="border bg-background px-3" defaultValue={device.hostname} maxLength={80} name="hostname" required/></Field>
            <Field label="Display name"><input className="border bg-background px-3" defaultValue={device.displayName} maxLength={160} name="displayName" required/></Field>
            <Field label="Asset tag"><input className="border bg-background px-3" defaultValue={device.assetTag ?? ""} maxLength={80} name="assetTag"/></Field>
            <Field label="Serial number"><input className="border bg-background px-3" defaultValue={device.serialNumber ?? ""} maxLength={120} name="serialNumber"/></Field>
            <Field label="Management IP"><input className="border bg-background px-3" defaultValue={device.managementIp ?? ""} maxLength={64} name="managementIp"/></Field>
            <Field label="Status"><select className="border bg-background px-3" defaultValue={device.status} name="status">{Object.values(DeviceStatus).map((status) => <option key={status}>{status}</option>)}</select></Field>
            <Field className="md:col-span-2" label="Location"><select className="border bg-background px-3" onChange={(event) => setLocationKey(event.target.value)} required value={locationKey}>{locations.map((location) => <option key={location.key} value={location.key}>{location.label}</option>)}</select></Field>
            <Field label="Vị trí U bắt đầu"><input className="border bg-background px-3 disabled:cursor-not-allowed disabled:opacity-50" defaultValue={device.rackUnitStart ?? ""} disabled={!selectedLocation?.rackId} min={1} name="rackUnitStart" placeholder={selectedLocation?.rackId ? "U bắt đầu" : "Chọn location có rack"} type="number"/></Field>
            <Field label="Chiều cao thiết bị (U)"><input className="border bg-background px-3" defaultValue={device.rackUnitsOverride ?? ""} min={1} step={1} name="rackUnitsOverride" placeholder={`${device.modelRackUnits ?? 1}U theo model`} type="number"/><span className="font-normal text-muted-foreground">Để trống để dùng {device.modelRackUnits ?? 1}U theo model. Chỉ áp dụng cho thiết bị này.</span></Field>
          </div>
          <fieldset className="mt-5 rounded-xl border p-4"><legend className="px-2 text-sm font-bold">Giá riêng cho thiết bị</legend><p className="mb-4 text-xs text-muted-foreground">Giá model: {device.modelUnitPriceVnd === null ? "Chưa có" : `${device.modelUnitPriceVnd.toLocaleString("vi-VN")} ₫`} · VAT {device.modelVatRateBps / 100}%. Để trống để dùng giá model.</p><div className="grid gap-4 md:grid-cols-3"><Field label="Đơn giá riêng (VND)"><input className="border bg-background px-3" defaultValue={device.unitPriceOverrideVnd ?? ""} min={0} name="unitPriceOverrideVnd" step={1000} type="number"/></Field><Field label="VAT riêng (%)"><input className="border bg-background px-3" defaultValue={device.priceVatRateOverrideBps === null ? "" : device.priceVatRateOverrideBps / 100} max={100} min={0} name="vatPercent" step="0.01" type="number"/></Field><Field label="Nguồn báo giá"><input className="border bg-background px-3" defaultValue={device.pricingSourceOverride ?? ""} maxLength={500} name="pricingSourceOverride"/></Field></div></fieldset>
          <Field className="mt-5" label="Notes"><textarea className="min-h-24 rounded-xl border bg-background p-3" defaultValue={device.notes ?? ""} maxLength={500} name="notes"/></Field>
          {error && <p aria-live="polite" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <div className="sticky bottom-0 mt-6 flex flex-col-reverse gap-2 border-t bg-card/95 pt-4 backdrop-blur sm:flex-row sm:justify-end"><Button onClick={() => setOpen(false)} type="button" variant="outline">Hủy</Button><Button disabled={busy || !selectedLocation} type="submit">{busy ? "Đang lưu…" : "Lưu thay đổi"}</Button></div>
        </form>
      </div>
    </div>}
  </>;
}

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) { return <label className={`grid gap-1.5 text-xs font-semibold ${className}`}>{label}{children}</label>; }
