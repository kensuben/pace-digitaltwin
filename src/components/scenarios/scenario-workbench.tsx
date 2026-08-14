"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Scenario = { id: string; name: string; type: string; isLocked: boolean; devices: Array<{ id: string; hostname: string; model: { category: string } }>; physicalLinks: Array<{ id: string; cableLabel: string | null; sourcePort: { device: { hostname: string } }; targetPort: { device: { hostname: string } } }> };
type Simulation = { riskLevel: string; impactedDeviceCount: number; availableCapacityMbps: number; impactedDevices: Array<{ id: string; hostname: string; reason: string }> };

export function ScenarioWorkbench({ scenarios }: { scenarios: Scenario[] }) {
  const router = useRouter();
  const [leftId, setLeftId] = useState(scenarios[0]?.id ?? "");
  const [rightId, setRightId] = useState(scenarios[1]?.id ?? scenarios[0]?.id ?? "");
  const [sourceId, setSourceId] = useState(scenarios[0]?.id ?? "");
  const [cloneName, setCloneName] = useState("Phương án demo mới");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failedDeviceIds, setFailedDeviceIds] = useState<string[]>([]);
  const [failedLinkIds, setFailedLinkIds] = useState<string[]>([]);
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const selected = scenarios.find((s) => s.id === sourceId);
  const selectClass = "w-full rounded-md border bg-background px-3 py-2 text-sm";

  async function clone() {
    setBusy(true); setMessage("");
    const response = await fetch(`/api/scenarios/${sourceId}/clone`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: cloneName }) });
    const payload = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage(payload.errors?.[0]?.message ?? "Không thể nhân bản scenario.");
    setMessage(`Đã tạo ${payload.data.name}.`); router.refresh();
  }

  async function simulate() {
    setBusy(true); setMessage("");
    const response = await fetch("/api/failure-simulations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scenarioId: sourceId, failedDeviceIds, failedLinkIds }) });
    const payload = await response.json(); setBusy(false);
    if (!response.ok) return setMessage(payload.errors?.[0]?.message ?? "Mô phỏng thất bại.");
    setSimulation(payload.data);
  }

  function toggle(id: string, values: string[], setter: (value: string[]) => void) { setter(values.includes(id) ? values.filter((item) => item !== id) : [...values, id]); }

  return <div className="grid gap-6 xl:grid-cols-2">
    <Card><CardHeader><CardTitle>Nhân bản phương án</CardTitle></CardHeader><CardContent className="space-y-4">
      <select className={selectClass} value={sourceId} onChange={(e) => { setSourceId(e.target.value); setFailedDeviceIds([]); setFailedLinkIds([]); setSimulation(null); }}>{scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <input className={selectClass} value={cloneName} onChange={(e) => setCloneName(e.target.value)} />
      <Button disabled={busy || !sourceId} onClick={clone}>Tạo bản sao độc lập</Button>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>So sánh hai phương án</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2"><select className={selectClass} value={leftId} onChange={(e) => setLeftId(e.target.value)}>{scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select><select className={selectClass} value={rightId} onChange={(e) => setRightId(e.target.value)}>{scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
      <Button disabled={!leftId || !rightId} onClick={() => router.push(`/scenarios/compare?leftId=${leftId}&rightId=${rightId}`)}>Mở bảng so sánh</Button>
    </CardContent></Card>
    <Card className="xl:col-span-2"><CardHeader><CardTitle>Mô phỏng sự cố tức thời</CardTitle></CardHeader><CardContent className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4"><p className="text-sm text-muted-foreground">Chọn thiết bị hoặc liên kết bị mất để tính lại khả năng kết nối đến Core/Firewall/ISP.</p>
        <div className="max-h-64 space-y-2 overflow-auto rounded-md border p-3">{selected?.devices.map((d) => <label className="flex items-center gap-2 text-sm" key={d.id}><input type="checkbox" checked={failedDeviceIds.includes(d.id)} onChange={() => toggle(d.id, failedDeviceIds, setFailedDeviceIds)} />{d.hostname} <span className="text-muted-foreground">{d.model.category}</span></label>)}{selected?.physicalLinks.map((l) => <label className="flex items-center gap-2 text-sm" key={l.id}><input type="checkbox" checked={failedLinkIds.includes(l.id)} onChange={() => toggle(l.id, failedLinkIds, setFailedLinkIds)} />{l.cableLabel ?? `${l.sourcePort.device.hostname} ↔ ${l.targetPort.device.hostname}`}</label>)}</div>
        <Button disabled={busy || !sourceId} onClick={simulate}>Chạy mô phỏng</Button></div>
      <div className="rounded-xl border bg-secondary/40 p-5">{simulation ? <div className="space-y-4"><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Mức rủi ro</p><p className="text-3xl font-bold text-primary">{simulation.riskLevel}</p></div><div className="grid grid-cols-2 gap-3"><Metric label="Thiết bị ảnh hưởng" value={simulation.impactedDeviceCount} /><Metric label="Capacity còn lại" value={`${simulation.availableCapacityMbps.toLocaleString()} Mbps`} /></div><div className="space-y-1 text-sm">{simulation.impactedDevices.slice(0, 8).map((d) => <p key={d.id}>• {d.hostname}: {d.reason}</p>)}</div></div> : <p className="text-sm text-muted-foreground">Kết quả tác động và capacity sẽ xuất hiện tại đây.</p>}</div>
    </CardContent></Card>
  </div>;
}

function Metric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-lg bg-background p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-bold">{value}</p></div>; }
