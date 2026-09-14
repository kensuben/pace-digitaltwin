"use client";

import { Cpu, HardDrive, MemoryStick, Pencil, Plus, Power, Trash2, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export type VirtualMachineDto = {
  id: string;
  hostname: string;
  displayName: string;
  role: string | null;
  operatingSystem: string | null;
  vcpuCount: number;
  memoryMb: number;
  storageGb: number;
  ipAddress: string | null;
  status: string;
  notes: string | null;
};

export function VirtualMachineManager({ scenarioId, server, isLocked, onClose, onChanged }: {
  scenarioId: string;
  server: { id: string; hostname: string; displayName: string; sku: string; virtualMachines: VirtualMachineDto[] };
  isLocked: boolean;
  onClose: () => void;
  onChanged: (machines: VirtualMachineDto[]) => void;
}) {
  const [machines, setMachines] = useState(server.virtualMachines);
  const [editing, setEditing] = useState<VirtualMachineDto | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const baseUrl = `/api/scenarios/${scenarioId}/servers/${server.id}/virtual-machines`;

  function publish(next: VirtualMachineDto[]) {
    const sorted = [...next].sort((left, right) => left.hostname.localeCompare(right.hostname));
    setMachines(sorted);
    onChanged(sorted);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const input = {
      hostname: form.get("hostname"), displayName: form.get("displayName"),
      role: form.get("role") || null, operatingSystem: form.get("operatingSystem") || null,
      vcpuCount: Number(form.get("vcpuCount")), memoryMb: Number(form.get("memoryMb")),
      storageGb: Number(form.get("storageGb")), ipAddress: form.get("ipAddress") || null,
      status: form.get("status"), notes: form.get("notes") || null,
    };
    const response = await fetch(editing ? `${baseUrl}/${editing.id}` : baseUrl, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const result = (await response.json()) as { data?: VirtualMachineDto; errors?: Array<{ message: string }> };
    setBusy(false);
    if (!response.ok || !result.data) {
      setMessage({ error: true, text: result.errors?.[0]?.message ?? "Không thể lưu Virtual Machine." });
      return;
    }
    const stored = editing ? { ...editing, ...input, ...result.data } as VirtualMachineDto : result.data;
    publish(editing ? machines.map((vm) => vm.id === editing.id ? stored : vm) : [...machines, stored]);
    setEditing(null);
    setShowForm(false);
    setMessage({ error: false, text: editing ? "Đã cập nhật Virtual Machine." : "Đã tạo Virtual Machine." });
  }

  async function remove(vm: VirtualMachineDto) {
    if (!window.confirm(`Xóa VM ${vm.hostname}?`)) return;
    setBusy(true);
    const response = await fetch(`${baseUrl}/${vm.id}`, { method: "DELETE" });
    const result = (await response.json()) as { errors?: Array<{ message: string }> };
    setBusy(false);
    if (!response.ok) {
      setMessage({ error: true, text: result.errors?.[0]?.message ?? "Không thể xóa Virtual Machine." });
      return;
    }
    publish(machines.filter((item) => item.id !== vm.id));
    if (editing?.id === vm.id) { setEditing(null); setShowForm(false); }
    setMessage({ error: false, text: `Đã xóa ${vm.hostname}.` });
  }

  const totals = machines.reduce((sum, vm) => ({ vcpu: sum.vcpu + vm.vcpuCount, memory: sum.memory + vm.memoryMb, storage: sum.storage + vm.storageGb }), { vcpu: 0, memory: 0, storage: 0 });
  return <div aria-labelledby="vm-manager-title" aria-modal="true" className="fixed inset-0 z-[70] grid place-items-center bg-black/75 p-3 backdrop-blur-sm sm:p-6" role="dialog" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-2xl">
      <header className="flex items-start justify-between gap-4 border-b p-4 sm:p-6"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Physical Server · {server.sku}</p><h2 className="mt-1 text-2xl font-bold" id="vm-manager-title">Virtual Machines · {server.hostname}</h2><p className="mt-1 text-sm text-muted-foreground">{server.displayName} · Quản lý tài nguyên compute chạy trên máy chủ vật lý này.</p></div><button aria-label="Đóng" className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground hover:text-foreground" onClick={onClose} type="button"><X size={19}/></button></header>
      <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[1.05fr_0.95fr]">
        <section className="border-b p-4 lg:border-b-0 lg:border-r sm:p-6">
          <div className="grid grid-cols-3 gap-2">
            <Summary icon={<Cpu size={16}/>} label="vCPU" value={totals.vcpu}/>
            <Summary icon={<MemoryStick size={16}/>} label="Memory" value={formatMemory(totals.memory)}/>
            <Summary icon={<HardDrive size={16}/>} label="Storage" value={`${totals.storage} GB`}/>
          </div>
          <div className="mt-5 flex items-center justify-between gap-3"><div><h3 className="font-bold">{machines.length} Virtual Machines</h3><p className="text-xs text-muted-foreground">Cấu hình theo scenario hiện tại</p></div>{!isLocked && <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); setMessage(null); }} type="button"><Plus size={15}/>Thêm VM</Button>}</div>
          <div className="mt-4 space-y-2">{machines.map((vm) => <article className="rounded-xl border bg-background/40 p-3" key={vm.id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><span className={`size-2 rounded-full ${vm.status === "RUNNING" ? "bg-emerald-400" : vm.status === "STOPPED" ? "bg-slate-500" : "bg-amber-400"}`}/><h4 className="truncate font-mono text-sm font-bold">{vm.hostname}</h4></div><p className="mt-1 truncate text-xs text-muted-foreground">{vm.displayName} · {vm.operatingSystem ?? "OS chưa khai báo"}</p></div>{!isLocked && <div className="flex shrink-0 gap-1"><button aria-label={`Sửa ${vm.hostname}`} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-primary" onClick={() => { setEditing(vm); setShowForm(true); setMessage(null); }} type="button"><Pencil size={15}/></button><button aria-label={`Xóa ${vm.hostname}`} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" disabled={busy} onClick={() => void remove(vm)} type="button"><Trash2 size={15}/></button></div>}</div><div className="mt-3 flex flex-wrap gap-1.5 text-[10px]"><Tag>{vm.vcpuCount} vCPU</Tag><Tag>{formatMemory(vm.memoryMb)}</Tag><Tag>{vm.storageGb} GB</Tag><Tag>{vm.ipAddress ?? "Chưa có IP"}</Tag><Tag>{vm.status}</Tag>{vm.role && <Tag>{vm.role}</Tag>}</div></article>)}
            {machines.length === 0 && <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Chưa có Virtual Machine trên server này.</div>}
          </div>
        </section>
        <section className="p-4 sm:p-6">
          {showForm ? <VmForm busy={busy} editing={editing} onCancel={() => { setEditing(null); setShowForm(false); }} onSubmit={save}/> : <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed p-8 text-center"><div><Power className="mx-auto text-primary" size={30}/><h3 className="mt-3 font-bold">Chọn VM để cập nhật</h3><p className="mt-1 max-w-sm text-sm text-muted-foreground">Hoặc tạo VM mới và khai báo tài nguyên, hệ điều hành, IP cùng trạng thái vận hành.</p></div></div>}
          {message && <p aria-live="polite" className={`mt-4 rounded-xl border px-3 py-2 text-sm ${message.error ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"}`}>{message.text}</p>}
        </section>
      </div>
    </div>
  </div>;
}

function VmForm({ editing, busy, onCancel, onSubmit }: { editing: VirtualMachineDto | null; busy: boolean; onCancel: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <form className="grid gap-3 sm:grid-cols-2" key={editing?.id ?? "new"} onSubmit={onSubmit}><div className="sm:col-span-2"><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{editing ? "Update VM" : "New VM"}</p><h3 className="mt-1 text-xl font-bold">{editing ? editing.hostname : "Khai báo Virtual Machine"}</h3></div><Field label="Hostname"><input className="border bg-background px-3" defaultValue={editing?.hostname} name="hostname" required/></Field><Field label="Display name"><input className="border bg-background px-3" defaultValue={editing?.displayName} name="displayName" required/></Field><Field label="Role"><input className="border bg-background px-3" defaultValue={editing?.role ?? ""} name="role" placeholder="Application, Database…"/></Field><Field label="Operating system"><input className="border bg-background px-3" defaultValue={editing?.operatingSystem ?? ""} name="operatingSystem" placeholder="Ubuntu Server 24.04"/></Field><Field label="vCPU"><input className="border bg-background px-3" defaultValue={editing?.vcpuCount ?? 2} max={1024} min={1} name="vcpuCount" required type="number"/></Field><Field label="Memory (MB)"><input className="border bg-background px-3" defaultValue={editing?.memoryMb ?? 4096} min={128} name="memoryMb" required step={128} type="number"/></Field><Field label="Storage (GB)"><input className="border bg-background px-3" defaultValue={editing?.storageGb ?? 50} min={1} name="storageGb" required type="number"/></Field><Field label="IP address"><input className="border bg-background px-3" defaultValue={editing?.ipAddress ?? ""} name="ipAddress" placeholder="10.181.20.10"/></Field><Field label="Status"><select className="border bg-background px-3" defaultValue={editing?.status ?? "PLANNED"} name="status">{["PLANNED", "RUNNING", "STOPPED", "SUSPENDED", "DECOMMISSIONED"].map((status) => <option key={status}>{status}</option>)}</select></Field><Field className="sm:col-span-2" label="Notes"><textarea className="min-h-20 rounded-xl border bg-background p-3" defaultValue={editing?.notes ?? ""} name="notes"/></Field><div className="flex flex-col-reverse gap-2 pt-2 sm:col-span-2 sm:flex-row sm:justify-end"><Button onClick={onCancel} type="button" variant="outline">Hủy</Button><Button disabled={busy} type="submit">{busy ? "Đang lưu…" : editing ? "Lưu cập nhật" : "Tạo Virtual Machine"}</Button></div></form>;
}
function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) { return <label className={`grid gap-1.5 text-xs font-semibold ${className}`}>{label}{children}</label>; }
function Summary({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) { return <div className="rounded-xl border bg-primary/5 p-3"><span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">{icon}{label}</span><strong className="mt-1 block text-sm text-primary sm:text-lg">{value}</strong></div>; }
function Tag({ children }: { children: React.ReactNode }) { return <span className="rounded-md bg-secondary px-2 py-1 text-muted-foreground">{children}</span>; }
function formatMemory(memoryMb: number) { return memoryMb >= 1024 ? `${Number((memoryMb / 1024).toFixed(1))} GB` : `${memoryMb} MB`; }
