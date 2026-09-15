"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Rack = { id: string; zoneId: string; code: string; name: string; rackUnits: number };
export function RackManagement({ racks, zones }: { racks: Rack[]; zones: { id: string; label: string }[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Rack | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [version, setVersion] = useState(0);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/racks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing?.id, zoneId: editing?.zoneId ?? data.get("zoneId"), code: data.get("code"), name: data.get("name"), rackUnits: Number(data.get("rackUnits")) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.errors?.[0]?.message ?? "Không thể lưu tủ rack.");
      setEditing(null); setVersion((value) => value + 1); setNotice("Đã lưu tủ rack."); router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Không thể kết nối máy chủ."); }
    finally { setBusy(false); }
  }
  return <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
    <section className="grid gap-4 sm:grid-cols-2">{racks.map((rack) => <article key={rack.id} className="rounded-2xl border bg-card p-5"><p className="text-xs text-muted-foreground">{zones.find((zone) => zone.id === rack.zoneId)?.label}</p><h2 className="mt-2 text-xl font-bold">{rack.code}</h2><p>{rack.name}</p><p className="my-3 font-mono text-primary">{rack.rackUnits}U</p><button disabled={busy} className="rounded-lg border px-4 py-2" onClick={() => { setEditing(rack); setNotice(""); }} type="button">Chỉnh sửa</button></article>)}{!racks.length && <p className="text-muted-foreground">Chưa có tủ rack. Tạo tủ đầu tiên bằng biểu mẫu bên cạnh.</p>}</section>
    <form key={`${editing?.id ?? "new"}:${version}`} onSubmit={save} className="space-y-4 rounded-2xl border bg-card p-5">
      <h2 className="text-xl font-bold">{editing ? `Chỉnh sửa ${editing.code}` : "Thêm tủ rack"}</h2>
      <label className="grid gap-2 text-sm">Phòng server<select name="zoneId" className="rounded-lg border bg-background p-3" defaultValue={editing?.zoneId ?? zones[0]?.id} disabled={!!editing || busy} required>{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.label}</option>)}</select></label>
      <label className="grid gap-2 text-sm">Mã tủ rack<input name="code" className="rounded-lg border bg-background p-3" defaultValue={editing?.code} maxLength={80} required/></label>
      <label className="grid gap-2 text-sm">Tên tủ rack<input name="name" className="rounded-lg border bg-background p-3" defaultValue={editing?.name} maxLength={160} required/></label>
      <label className="grid gap-2 text-sm">Chiều cao (U)<input name="rackUnits" className="rounded-lg border bg-background p-3" type="number" defaultValue={editing?.rackUnits ?? 42} min={1} max={100} step={1} required/></label>
      {!zones.length && <p className="text-sm text-destructive">Cần khai báo phòng server B2 trước khi tạo tủ rack.</p>}
      {notice && <p role="status" className="text-sm">{notice}</p>}
      <div className="flex gap-3"><button disabled={busy || !zones.length} className="rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground disabled:opacity-50">{busy ? "Đang lưu…" : "Lưu tủ rack"}</button>{editing && <button disabled={busy} type="button" className="rounded-lg border px-4 py-2" onClick={() => { setEditing(null); setNotice(""); }}>Hủy / Thêm mới</button>}</div>
    </form>
  </div>;
}
