import { AppShell } from "@/components/app-shell";
import { ScenarioWorkbench } from "@/components/scenarios/scenario-workbench";
import { Card, CardContent } from "@/components/ui/card";
import { PrismaScenarioRepository, type ScenarioAnalysisRecord } from "@/server/repositories/scenarioRepository";

export const dynamic = "force-dynamic";

export default async function ScenariosPage() {
  const repository = new PrismaScenarioRepository();
  const summaries = await repository.list();
  const analyses = await Promise.all(summaries.map((item) => repository.getAnalysis(item.id)));
  const scenarios = analyses.filter((item): item is ScenarioAnalysisRecord => item !== null);
  const totals = summaries.reduce((out, scenario) => ({ devices: out.devices + scenario._count.devices, links: out.links + scenario._count.physicalLinks }), { devices: 0, links: 0 });
  return <AppShell><div className="space-y-8">
    <div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">M5 · Decision lab</p><h1 className="mt-2 text-4xl font-bold">Scenario & Failure Simulation</h1><p className="mt-3 max-w-3xl text-muted-foreground">Nhân bản cấu hình hiện tại, thử thay đổi độc lập, so sánh chi phí và nhìn ngay phạm vi ảnh hưởng khi thiết bị hoặc đường truyền gặp sự cố.</p></div>
    <div className="grid gap-4 sm:grid-cols-3"><Stat label="Phương án" value={summaries.length} /><Stat label="Thiết bị được phân tích" value={totals.devices} /><Stat label="Liên kết được phân tích" value={totals.links} /></div>
    <ScenarioWorkbench scenarios={scenarios} />
  </div></AppShell>;
}

function Stat({ label, value }: { label: string; value: number }) { return <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold">{value.toLocaleString("vi-VN")}</p></CardContent></Card>; }
