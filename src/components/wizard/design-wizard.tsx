"use client";

import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, CircleAlert, FlaskConical, Network, Replace, Rocket, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ScenarioOption = { id: string; name: string; type: string; isLocked: boolean; deviceCount: number; linkCount: number };
type Model = { id: string; category: string; sku: string; modelName: string; unitPriceVnd: number | null; vendor: { name: string } };
type Device = { id: string; hostname: string; displayName: string; modelId: string; model: { category: string; sku: string; modelName: string; unitPriceVnd: number | null } };
type Link = { id: string; cableLabel: string | null; speedMbps: number; sourcePort: { device: { hostname: string } }; targetPort: { device: { hostname: string } } };
type DesignContext = { scenario: { id: string; name: string; isLocked: boolean; devices: Device[]; physicalLinks: Link[] }; models: Model[] };
type SwapPreview = { summary: { currentModel: { modelName: string; unitPriceVnd: number | null }; targetModel: { modelName: string; unitPriceVnd: number | null }; currentPortCount: number; targetPortCount: number }; mapping: { mappings: unknown[]; unmapped: unknown[] }; findings: Array<{ severity: string; message: string }> };
type Simulation = { riskLevel: string; impactedDeviceCount: number; availableCapacityMbps: number; capacityDeltaMbps: number; impactedDevices: Array<{ id: string; hostname: string; reason: string }> };
type Comparison = { costDeltaVnd: number; deviceChanges: { added: string[]; removed: string[]; replaced: Array<{ hostname: string; from: string; to: string }> }; linkChanges: { added: string[]; removed: string[] } };

const steps = [
  { title: "Khởi tạo", subtitle: "Chọn thiết kế gốc", icon: Sparkles },
  { title: "Kiểm tra", subtitle: "Phạm vi hệ thống", icon: Network },
  { title: "Customize", subtitle: "Thay thế thiết bị", icon: Replace },
  { title: "Simulation", subtitle: "Kịch bản sự cố", icon: FlaskConical },
  { title: "Kết quả", subtitle: "Đánh giá quyết định", icon: Rocket },
];
const inputClass = "w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";
const formatMoney = (value: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);

export function DesignWizard({ scenarios }: { scenarios: ScenarioOption[] }) {
  const [step, setStep] = useState(0);
  const [sourceId, setSourceId] = useState(scenarios.find((s) => s.type === "PROPOSED")?.id ?? scenarios[0]?.id ?? "");
  const [sourceName, setSourceName] = useState("");
  const [workingId, setWorkingId] = useState("");
  const [context, setContext] = useState<DesignContext | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [targetModelId, setTargetModelId] = useState("");
  const [preview, setPreview] = useState<SwapPreview | null>(null);
  const [failedDevices, setFailedDevices] = useState<string[]>([]);
  const [failedLinks, setFailedLinks] = useState<string[]>([]);
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const selectedDevice = context?.scenario.devices.find((device) => device.id === selectedDeviceId);
  const compatibleModels = useMemo(() => context?.models.filter((model) => model.category === selectedDevice?.model.category && model.id !== selectedDevice.modelId) ?? [], [context, selectedDevice]);

  async function api<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init); const payload = await response.json() as { data: T | null; errors: Array<{ message: string }> };
    if (!response.ok || !payload.data) throw new Error(payload.errors[0]?.message ?? "Không thể hoàn tất thao tác.");
    return payload.data;
  }
  async function loadContext(id: string) { const data = await api<DesignContext>(`/api/scenarios/${id}/design-context`); setContext(data); return data; }
  async function createAlternative() {
    setBusy(true); setNotice("");
    try {
      const result = await api<{ id: string; name: string }>(`/api/scenarios/${sourceId}/clone`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: sourceName || `Phương án thiết kế ${new Date().toLocaleDateString("vi-VN")}` }) });
      setWorkingId(result.id); await loadContext(result.id); setStep(1); setNotice(`Đã tạo workspace “${result.name}”.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Không thể tạo phương án."); } finally { setBusy(false); }
  }
  async function previewSwap() {
    if (!selectedDeviceId || !targetModelId) return; setBusy(true); setNotice("");
    try { setPreview(await api<SwapPreview>(`/api/devices/${selectedDeviceId}/swap-model/preview`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scenarioId: workingId, targetModelId }) })); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Không thể preview."); } finally { setBusy(false); }
  }
  async function commitSwap() {
    if (!preview) return; setBusy(true);
    try { await api(`/api/devices/${selectedDeviceId}/swap-model`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scenarioId: workingId, targetModelId, commitWithWarnings: preview.findings.length > 0 }) }); await loadContext(workingId); setPreview(null); setTargetModelId(""); setNotice("Đã áp dụng thay thế. Tổng chi phí sẽ được tính lại tự động."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Không thể áp dụng."); } finally { setBusy(false); }
  }
  function toggle(id: string, values: string[], setter: (next: string[]) => void) { setter(values.includes(id) ? values.filter((value) => value !== id) : [...values, id]); setSimulation(null); }
  async function runSimulation() {
    setBusy(true); setNotice("");
    try { setSimulation(await api<Simulation>("/api/failure-simulations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scenarioId: workingId, failedDeviceIds: failedDevices, failedLinkIds: failedLinks }) })); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Không thể chạy simulation."); } finally { setBusy(false); }
  }
  async function finish() {
    setBusy(true);
    try { setComparison(await api<Comparison>(`/api/scenarios/compare?leftId=${sourceId}&rightId=${workingId}`)); setStep(4); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Không thể tổng hợp kết quả."); } finally { setBusy(false); }
  }

  return <div className="space-y-7">
    <header className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-card via-card to-primary/10 p-7 md:p-10"><div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" /><p className="text-sm font-bold uppercase tracking-[0.22em] text-primary">Guided design studio</p><h1 className="mt-3 max-w-4xl text-4xl font-bold tracking-tight md:text-5xl">Thiết kế, thử nghiệm và bảo vệ quyết định đầu tư mạng</h1><p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">Wizard biến quy trình kỹ thuật phức tạp thành 5 bước có kiểm soát. Mọi thay đổi diễn ra trên bản sao, không ảnh hưởng baseline.</p></header>
    <nav aria-label="Tiến trình thiết kế" className="grid gap-2 lg:grid-cols-5">{steps.map((item, index) => { const Icon=item.icon; const active=index===step; const done=index<step; return <button key={item.title} disabled={index>step} onClick={() => index<step && setStep(index)} className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${active?"border-primary bg-primary/10 shadow-[0_0_30px_rgb(45_212_191/0.08)]":done?"bg-secondary/70":"opacity-55"}`}><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${active?"bg-primary text-primary-foreground":"bg-background text-muted-foreground"}`}>{done?<Check size={19}/>:<Icon size={19}/>}</span><span><b className="block text-sm">{index+1}. {item.title}</b><span className="text-xs text-muted-foreground">{item.subtitle}</span></span></button>})}</nav>
    {notice && <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm"><CircleAlert className="mt-0.5 shrink-0 text-primary" size={18}/><p>{notice}</p></div>}
    <Card className="min-h-[420px] rounded-3xl"><CardHeader><CardTitle>{steps[step].title}: {steps[step].subtitle}</CardTitle></CardHeader><CardContent>
      {step===0 && <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]"><div className="space-y-5"><Field label="Thiết kế nguồn"><select className={inputClass} value={sourceId} onChange={(e)=>setSourceId(e.target.value)}>{scenarios.map((scenario)=><option key={scenario.id} value={scenario.id}>{scenario.name} · {scenario.deviceCount} thiết bị {scenario.isLocked?"· Baseline khóa":""}</option>)}</select></Field><Field label="Tên phương án mới"><input className={inputClass} placeholder="VD: Phương án Cisco 25G cho Core" value={sourceName} onChange={(e)=>setSourceName(e.target.value)}/></Field><Button className="h-12 px-6" disabled={busy||!sourceId} onClick={createAlternative}>Tạo workspace an toàn <ChevronRight size={17}/></Button></div><Guide title="Nguyên tắc an toàn" items={["Baseline không bị chỉnh sửa", "Thiết bị, VLAN, vị trí và chi phí được clone", "Mọi quyết định có thể so sánh ngược với nguồn"]}/></div>}
      {step===1 && context && <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-3"><Kpi label="Thiết bị" value={context.scenario.devices.length}/><Kpi label="Physical links" value={context.scenario.physicalLinks.length}/><Kpi label="Model khả dụng" value={context.models.length}/></div>{!context.scenario.physicalLinks.length&&<div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100"><b>Topology chưa có liên kết.</b> Simulation vẫn xác định thiết bị mất đường về Core, nhưng capacity sẽ bằng 0 cho tới khi nối port trong Topology.</div>}<div className="flex justify-end"><Button onClick={()=>setStep(2)}>Xác nhận phạm vi <ChevronRight size={17}/></Button></div></div>}
      {step===2 && context && <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]"><div className="space-y-4"><Field label="Thiết bị cần thay"><select className={inputClass} value={selectedDeviceId} onChange={(e)=>{setSelectedDeviceId(e.target.value);setTargetModelId("");setPreview(null)}}><option value="">Chọn thiết bị…</option>{context.scenario.devices.map((device)=><option key={device.id} value={device.id}>{device.hostname} · {device.model.sku}</option>)}</select></Field><Field label="Model thay thế cùng nhóm"><select className={inputClass} disabled={!selectedDevice} value={targetModelId} onChange={(e)=>{setTargetModelId(e.target.value);setPreview(null)}}><option value="">Chọn model tương thích…</option>{compatibleModels.map((model)=><option key={model.id} value={model.id}>{model.vendor.name} {model.sku} · {model.unitPriceVnd===null?"Chưa có giá":formatMoney(model.unitPriceVnd)}</option>)}</select></Field><Button variant="outline" disabled={busy||!targetModelId} onClick={previewSwap}>Phân tích trước khi thay</Button></div><div className="rounded-2xl border bg-secondary/40 p-5">{preview?<div className="space-y-4"><p className="font-bold">{preview.summary.currentModel.modelName} → {preview.summary.targetModel.modelName}</p><div className="grid grid-cols-2 gap-3"><Kpi label="Port hiện tại" value={preview.summary.currentPortCount}/><Kpi label="Port mới" value={preview.summary.targetPortCount}/></div><p className="text-sm">Cost impact: <b>{preview.summary.currentModel.unitPriceVnd===null||preview.summary.targetModel.unitPriceVnd===null?"Thiếu giá":formatMoney(preview.summary.targetModel.unitPriceVnd-preview.summary.currentModel.unitPriceVnd)}</b></p>{preview.findings.map((finding)=><p className="text-sm text-amber-300" key={finding.message}>{finding.severity}: {finding.message}</p>)}<Button disabled={busy} onClick={commitSwap}>Áp dụng thay thế</Button></div>:<p className="text-sm leading-6 text-muted-foreground">Chọn thiết bị và model để xem port mapping, cảnh báo tương thích và tác động chi phí trước khi commit.</p>}</div><div className="flex justify-between lg:col-span-2"><Button variant="outline" onClick={()=>setStep(1)}><ChevronLeft size={17}/> Quay lại</Button><Button onClick={()=>setStep(3)}>Tiếp tục simulation <ChevronRight size={17}/></Button></div></div>}
      {step===3 && context && <div className="grid gap-6 lg:grid-cols-2"><div><p className="mb-3 text-sm text-muted-foreground">Chọn đồng thời nhiều failure target để mô phỏng session.</p><div className="max-h-72 space-y-2 overflow-auto rounded-2xl border p-3">{context.scenario.devices.map((device)=><CheckRow key={device.id} checked={failedDevices.includes(device.id)} label={`${device.hostname} · ${device.model.category}`} onChange={()=>toggle(device.id,failedDevices,setFailedDevices)}/>)}{context.scenario.physicalLinks.map((link)=><CheckRow key={link.id} checked={failedLinks.includes(link.id)} label={link.cableLabel??`${link.sourcePort.device.hostname} ↔ ${link.targetPort.device.hostname}`} onChange={()=>toggle(link.id,failedLinks,setFailedLinks)}/>)}</div><Button className="mt-4" disabled={busy} onClick={runSimulation}>Chạy network session test</Button></div><div className="rounded-2xl border bg-secondary/40 p-5">{simulation?<div className="space-y-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${simulation.riskLevel==="LOW"?"bg-emerald-400/15 text-emerald-300":"bg-rose-400/15 text-rose-300"}`}>{simulation.riskLevel} RISK</span><div className="grid grid-cols-2 gap-3"><Kpi label="Thiết bị ảnh hưởng" value={simulation.impactedDeviceCount}/><Kpi label="Capacity còn lại" value={`${simulation.availableCapacityMbps.toLocaleString()} Mbps`}/></div><div className="max-h-36 overflow-auto text-sm">{simulation.impactedDevices.slice(0,20).map((device)=><p key={device.id}>• {device.hostname} — {device.reason}</p>)}</div><Button onClick={finish}>Tổng hợp kết quả <ChevronRight size={17}/></Button></div>:<p className="text-sm leading-6 text-muted-foreground">Kết quả risk, impacted endpoints và capacity còn lại sẽ xuất hiện ở đây.</p>}</div></div>}
      {step===4 && comparison && <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-3"><Kpi label="Chênh lệch đầu tư" value={formatMoney(comparison.costDeltaVnd)}/><Kpi label="Thiết bị đã thay" value={comparison.deviceChanges.replaced.length}/><Kpi label="Thiết bị ảnh hưởng" value={simulation?.impactedDeviceCount??0}/></div><div className="grid gap-4 lg:grid-cols-2"><Guide title="Thay đổi được đề xuất" items={comparison.deviceChanges.replaced.length?comparison.deviceChanges.replaced.map((item)=>`${item.hostname}: ${item.from} → ${item.to}`):["Không thay đổi model thiết bị"]}/><Guide title="Kết luận simulation" items={[`Risk: ${simulation?.riskLevel??"Chưa chạy"}`,`Capacity còn lại: ${simulation?.availableCapacityMbps.toLocaleString()??"—"} Mbps`,`Endpoints ảnh hưởng: ${simulation?.impactedDeviceCount??0}`]}/></div><div className="flex flex-wrap gap-3"><a className="rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground" href={`/scenarios/compare?leftId=${sourceId}&rightId=${workingId}`}>Mở báo cáo chi tiết</a><a className="rounded-lg border px-5 py-3 text-sm font-bold" href={`/topology/${workingId}`}>Tiếp tục chỉnh Topology</a></div></div>}
    </CardContent></Card>
  </div>;
}

function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block space-y-2"><span className="text-sm font-semibold">{label}</span>{children}</label>}
function Kpi({label,value}:{label:string;value:string|number}){return <div className="rounded-2xl border bg-background/60 p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>}
function Guide({title,items}:{title:string;items:string[]}){return <div className="rounded-2xl border bg-secondary/40 p-5"><p className="font-bold">{title}</p><ul className="mt-4 space-y-3 text-sm text-muted-foreground">{items.map((item)=><li className="flex gap-2" key={item}><Check className="mt-0.5 shrink-0 text-primary" size={16}/>{item}</li>)}</ul></div>}
function CheckRow({checked,label,onChange}:{checked:boolean;label:string;onChange:()=>void}){return <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition ${checked?"border-primary bg-primary/10":"hover:bg-secondary"}`}><input type="checkbox" checked={checked} onChange={onChange}/><span>{label}</span></label>}
