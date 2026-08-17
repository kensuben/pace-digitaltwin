import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getInventoryOptions } from "@/server/services/inventoryService";

export const dynamic = "force-dynamic";

export default async function RackDesignIndexPage() {
  const { scenarios } = await getInventoryOptions();
  return <AppShell><div className="space-y-8">
    <div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">B2 · Physical design</p><h1 className="mt-2 text-4xl font-bold">Thiết kế tủ rack phòng server</h1><p className="mt-3 max-w-3xl text-muted-foreground">Chọn scenario để bố trí trực quan các thiết bị B2 theo từng rack unit, kiểm tra sức chứa và tránh chồng lấn.</p></div>
    <div className="grid gap-4 md:grid-cols-2">{scenarios.map((scenario) => <Card key={scenario.id}><CardHeader><CardTitle>{scenario.name} {scenario.isLocked ? "🔒" : ""}</CardTitle></CardHeader><CardContent><Link className="font-semibold text-primary hover:underline" href={`/racks/${scenario.id}`}>Mở rack designer →</Link></CardContent></Card>)}</div>
  </div></AppShell>;
}
