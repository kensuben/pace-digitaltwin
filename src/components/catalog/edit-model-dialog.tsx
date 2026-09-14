"use client";

import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DeviceCategory } from "@/generated/prisma/enums";

type EditableProfile = {
  portGroup: string; count: number; media: string; supportedSpeedsMbps: number[];
  poeStandard: string; roleHint: string; breakoutCapable: boolean;
  namePrefix: string; startNumber: number; sortOrder: number;
};
type EditableProfileState = EditableProfile & { speedsText: string };

export type EditableCatalogModel = {
  id: string; vendorName: string; sku: string; modelName: string; category: string;
  formFactor: string | null; rackUnits: number | null;
  switchingCapacityGbps: number | null; firewallGbps: number | null;
  managementOs: string | null; sourceUrl: string | null;
  supportsLacp: boolean; supportsMlag: boolean; supportsStacking: boolean; supportsHa: boolean;
  portProfiles: EditableProfile[];
};

export function EditCatalogModelButton({ model }: { model: EditableCatalogModel }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const withSpeedText = (items: EditableProfile[]): EditableProfileState[] => items.map((profile) => ({
    ...profile,
    speedsText: profile.supportedSpeedsMbps.join(", "),
  }));
  const [profiles, setProfiles] = useState(withSpeedText(model.portProfiles));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function updateProfile(index: number, patch: Partial<EditableProfileState>) {
    setProfiles((current) => current.map((profile, profileIndex) => profileIndex === index ? { ...profile, ...patch } : profile));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const optionalNumber = (name: string) => form.get(name) ? Number(form.get(name)) : null;
    const body = {
      category: form.get("category"), modelName: form.get("modelName"),
      formFactor: form.get("formFactor") || null, rackUnits: optionalNumber("rackUnits"),
      switchingCapacityGbps: optionalNumber("switchingCapacityGbps"),
      firewallGbps: optionalNumber("firewallGbps"), managementOs: form.get("managementOs") || null,
      sourceUrl: form.get("sourceUrl") || null,
      supportsLacp: form.get("supportsLacp") === "on", supportsMlag: form.get("supportsMlag") === "on",
      supportsStacking: form.get("supportsStacking") === "on", supportsHa: form.get("supportsHa") === "on",
      portProfiles: profiles.map(({ speedsText, ...profile }) =>
        speedsText.trim() ? profile : { ...profile, supportedSpeedsMbps: [] },
      ),
    };
    const response = await fetch(`/api/catalog/${model.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const result = (await response.json()) as { errors?: Array<{ message: string }> };
    setBusy(false);
    if (!response.ok) {
      setError(result.errors?.[0]?.message ?? "Không thể cập nhật model.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return <>
    <button className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-primary/30 px-2 py-2 text-xs font-bold text-primary transition hover:bg-primary/10" onClick={() => { setProfiles(withSpeedText(model.portProfiles)); setError(""); setOpen(true); }} type="button"><Pencil size={14}/>Edit</button>
    {open && <div aria-labelledby="edit-model-title" aria-modal="true" className="fixed inset-0 z-[70] grid place-items-center bg-black/75 p-3 backdrop-blur-sm sm:p-6" role="dialog" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b p-4 sm:p-6"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{model.vendorName} · {model.sku}</p><h2 className="mt-1 text-2xl font-bold" id="edit-model-title">Cập nhật Device Model</h2><p className="mt-1 text-sm text-muted-foreground">SKU và Vendor là định danh cố định. Các thông số còn lại có thể cập nhật.</p></div><button aria-label="Đóng" className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground hover:text-foreground" onClick={() => setOpen(false)} type="button"><X size={19}/></button></header>
        <form className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field label="Model name"><input autoFocus className="border bg-background px-3" defaultValue={model.modelName} name="modelName" required/></Field>
            <Field label="Category"><select className="border bg-background px-3" defaultValue={model.category} name="category">{Object.values(DeviceCategory).map((category) => <option key={category}>{category}</option>)}</select></Field>
            <Field label="Form factor"><input className="border bg-background px-3" defaultValue={model.formFactor ?? ""} name="formFactor" placeholder="1U"/></Field>
            <Field label="Rack units"><input className="border bg-background px-3" defaultValue={model.rackUnits ?? ""} min={1} name="rackUnits" type="number"/></Field>
            <Field label="Switching capacity (Gbps)"><input className="border bg-background px-3" defaultValue={model.switchingCapacityGbps ?? ""} min={0.01} name="switchingCapacityGbps" step="any" type="number"/></Field>
            <Field label="Firewall throughput (Gbps)"><input className="border bg-background px-3" defaultValue={model.firewallGbps ?? ""} min={0.01} name="firewallGbps" step="any" type="number"/></Field>
            <Field label="Management OS"><input className="border bg-background px-3" defaultValue={model.managementOs ?? ""} name="managementOs"/></Field>
            <Field className="md:col-span-2" label="Evidence URL"><input className="border bg-background px-3" defaultValue={model.sourceUrl ?? ""} name="sourceUrl" placeholder="https://…" type="url"/></Field>
          </div>
          <fieldset className="mt-5 rounded-xl border p-4"><legend className="px-2 text-sm font-bold">Capabilities</legend><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Check defaultChecked={model.supportsLacp} label="LACP" name="supportsLacp"/><Check defaultChecked={model.supportsMlag} label="MLAG" name="supportsMlag"/><Check defaultChecked={model.supportsStacking} label="Stacking" name="supportsStacking"/><Check defaultChecked={model.supportsHa} label="High Availability" name="supportsHa"/></div></fieldset>
          <section className="mt-5"><div className="flex items-center justify-between gap-3"><div><h3 className="font-bold">Port Profiles</h3><p className="text-xs text-muted-foreground">Mỗi group sinh ra một nhóm cổng vật lý.</p></div><Button onClick={() => setProfiles((current) => [...current, { portGroup: `GROUP-${current.length + 1}`, count: 1, media: "RJ45", supportedSpeedsMbps: [1000], speedsText: "1000", poeStandard: "NONE", roleHint: "DATA", breakoutCapable: false, namePrefix: "port", startNumber: 1, sortOrder: (current.length + 1) * 10 }])} size="sm" type="button" variant="outline"><Plus size={14}/>Thêm group</Button></div>
            <div className="mt-3 space-y-3">{profiles.map((profile, index) => <div className="grid gap-3 rounded-xl border bg-background/35 p-3 sm:grid-cols-2 lg:grid-cols-6" key={`${profile.portGroup}-${index}`}><Field label="Group"><input className="border bg-background px-3" onChange={(event) => updateProfile(index, { portGroup: event.target.value })} required value={profile.portGroup}/></Field><Field label="Count"><input className="border bg-background px-3" min={1} onChange={(event) => updateProfile(index, { count: Number(event.target.value) })} required type="number" value={profile.count}/></Field><Field label="Media"><select className="border bg-background px-3" onChange={(event) => updateProfile(index, { media: event.target.value })} value={profile.media}>{["RJ45", "SFP", "SFP_PLUS", "SFP28", "QSFP28"].map((media) => <option key={media}>{media}</option>)}</select></Field><Field label="Speeds Mbps"><input className="border bg-background px-3" onChange={(event) => updateProfile(index, { speedsText: event.target.value, supportedSpeedsMbps: event.target.value.split(",").map((value) => Number(value.trim())).filter(Number.isFinite) })} required value={profile.speedsText}/></Field><Field label="Port prefix"><input className="border bg-background px-3" onChange={(event) => updateProfile(index, { namePrefix: event.target.value })} required value={profile.namePrefix}/></Field><div className="flex items-end"><button aria-label={`Xóa group ${profile.portGroup}`} className="grid size-11 place-items-center rounded-xl border text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive disabled:opacity-40" disabled={profiles.length === 1} onClick={() => setProfiles((current) => current.filter((_, profileIndex) => profileIndex !== index))} type="button"><Trash2 size={16}/></button></div></div>)}</div>
          </section>
          {error && <p aria-live="polite" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <div className="sticky bottom-0 mt-6 flex flex-col-reverse gap-2 border-t bg-card/95 pt-4 backdrop-blur sm:flex-row sm:justify-end"><Button onClick={() => setOpen(false)} type="button" variant="outline">Hủy</Button><Button disabled={busy || profiles.length === 0} type="submit">{busy ? "Đang lưu…" : "Lưu thay đổi"}</Button></div>
        </form>
      </div>
    </div>}
  </>;
}

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) { return <label className={`grid gap-1.5 text-xs font-semibold ${className}`}>{label}{children}</label>; }
function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) { return <label className="flex min-h-11 items-center gap-2 rounded-lg bg-secondary/50 px-3 text-xs font-semibold"><input className="size-4 min-h-0" defaultChecked={defaultChecked} name={name} type="checkbox"/>{label}</label>; }
