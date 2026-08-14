import Link from "next/link";
import { ArrowRight, Boxes, CircleDollarSign, FlaskConical, Map, Network, WandSparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { PrismaScenarioRepository } from "@/server/repositories/scenarioRepository";

export const dynamic = "force-dynamic";

const modules = [
  { href: "/design-wizard", title: "Guided System Design", text: "Thiết kế phương án và chạy simulation theo 5 bước có kiểm soát.", icon: WandSparkles, accent: true },
  { href: "/topology", title: "Network Topology", text: "Nối port, kiểm tra capacity và quan sát kiến trúc mạng.", icon: Network },
  { href: "/costs", title: "Investment Dashboard", text: "Theo dõi ngân sách, VAT và tác động khi thay model.", icon: CircleDollarSign },
  { href: "/scenarios", title: "Scenario Lab", text: "Clone, so sánh và thử các kịch bản failure nâng cao.", icon: FlaskConical },
  { href: "/inventory", title: "Managed Inventory", text: "Quản lý thiết bị và trạng thái triển khai theo tầng.", icon: Boxes },
  { href: "/drawings", title: "Spatial Planning", text: "Bản vẽ, vị trí thiết bị và tuyến cáp đa tầng.", icon: Map },
];

export default async function HomePage() {
  const scenarios = await new PrismaScenarioRepository().list();
  const deviceCount = scenarios.reduce((sum, item) => sum + item._count.devices, 0);
  return <AppShell><div className="space-y-9">
    <section className="relative overflow-hidden rounded-[2rem] border bg-gradient-to-br from-card via-card to-primary/15 px-7 py-12 md:px-12 md:py-16"><div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/15 blur-3xl"/><p className="text-sm font-bold uppercase tracking-[0.25em] text-primary">PACE Smart Campus 181</p><h1 className="mt-4 max-w-4xl text-5xl font-bold tracking-tight md:text-7xl">Từ bản vẽ đến quyết định đầu tư mạng.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">Một digital twin hợp nhất thiết bị, topology, không gian, chi phí và mô phỏng rủi ro trong cùng quy trình.</p><div className="mt-8 flex flex-wrap gap-3"><Link className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground" href="/design-wizard">Bắt đầu thiết kế <ArrowRight size={18}/></Link><Link className="rounded-xl border bg-background/50 px-6 py-3 font-bold" href="/scenarios">Mở Scenario Lab</Link></div></section>
    <section className="grid gap-4 sm:grid-cols-3"><Metric label="Scenario đang quản lý" value={scenarios.length}/><Metric label="Device instances" value={deviceCount}/><Metric label="Milestone hoàn tất" value="11 / 14"/></section>
    <section><div className="mb-5"><p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">Workspace</p><h2 className="mt-2 text-3xl font-bold">Chọn công việc cần thực hiện</h2></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{modules.map((module)=>{const Icon=module.icon;return <Link href={module.href} key={module.href}><Card className={`h-full rounded-2xl transition hover:-translate-y-1 hover:border-primary/60 hover:shadow-xl ${module.accent?"border-primary/40 bg-primary/5":""}`}><CardContent className="pt-6"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon size={23}/></span><h3 className="mt-5 text-xl font-bold">{module.title}</h3><p className="mt-2 leading-6 text-muted-foreground">{module.text}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary">Mở module <ArrowRight size={15}/></span></CardContent></Card></Link>})}</div></section>
  </div></AppShell>;
}
function Metric({label,value}:{label:string;value:string|number}){return <Card className="rounded-2xl"><CardContent className="pt-6"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold">{typeof value==="number"?value.toLocaleString("vi-VN"):value}</p></CardContent></Card>}
