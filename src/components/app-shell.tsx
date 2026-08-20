"use client";

import { Boxes, ChevronDown, CircleDollarSign, FlaskConical, LayoutDashboard, Map, Menu, Network, Server, ShieldCheck, SlidersHorizontal, WandSparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const navigation = [
  { label: "Thiết kế", items: [
    { href: "/topology", label: "Floor Topology", description: "Thiết kế vật lý theo từng tầng", icon: Network },
    { href: "/design-wizard", label: "Design Wizard", description: "Quy trình thiết kế từng bước", icon: WandSparkles },
    { href: "/network-config", label: "LAG / VLAN / IP", description: "Cấu hình mạng logical", icon: SlidersHorizontal },
    { href: "/validation", label: "Validation", description: "Kiểm tra lỗi và tính sẵn sàng", icon: ShieldCheck },
  ]},
  { label: "Tài sản", items: [
    { href: "/inventory", label: "Inventory", description: "Thiết bị theo scenario và vị trí", icon: Boxes },
    { href: "/catalog", label: "Device Catalog", description: "Model, thông số và port profile", icon: Server },
    { href: "/costs", label: "Project Costs", description: "Chi phí thiết bị và tổng đầu tư", icon: CircleDollarSign },
  ]},
  { label: "Không gian", items: [
    { href: "/drawings", label: "Drawings", description: "Bản vẽ, floor map và spatial editor", icon: Map },
    { href: "/racks", label: "B2 Rack Designer", description: "Bố trí thiết bị trực quan theo rack unit", icon: Server },
  ]},
  { label: "Kịch bản", items: [
    { href: "/scenarios", label: "Scenario Lab", description: "Clone và mô phỏng sự cố", icon: FlaskConical },
    { href: "/scenarios/compare", label: "Scenario Compare", description: "So sánh thiết bị, rủi ro và chi phí", icon: LayoutDashboard },
  ]},
] as const;

function matches(pathname: string, href: string) { return pathname === href || pathname.startsWith(`${href}/`); }
function itemMatches(pathname: string, href: string) { return href === "/scenarios" ? pathname === href : matches(pathname, href); }

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const [openDesktopMenu, setOpenDesktopMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMobileGroup, setOpenMobileGroup] = useState<string | null>(null);
  const desktopNavigationRef = useRef<HTMLElement>(null);

  useEffect(() => { setOpenDesktopMenu(null); setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    function closeDesktopMenu(event: PointerEvent) { if (!desktopNavigationRef.current?.contains(event.target as Node)) setOpenDesktopMenu(null); }
    function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") { setOpenDesktopMenu(null); setMobileOpen(false); } }
    document.addEventListener("pointerdown", closeDesktopMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeDesktopMenu); document.removeEventListener("keydown", closeOnEscape); };
  }, []);
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [mobileOpen]);

  return <div className="min-h-screen">
    <header className="sticky top-0 z-40 border-b border-white/8 bg-background/82 shadow-[0_1px_0_rgba(255,255,255,0.025)] backdrop-blur-2xl">
      <div className="mx-auto flex h-[4.5rem] max-w-[90rem] items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <Brand />
        <nav aria-label="Điều hướng chính" className="hidden items-center gap-1 xl:flex" ref={desktopNavigationRef}>
          <DesktopHomeLink pathname={pathname}/>
          {navigation.map((group) => {
            const active = group.items.some((item) => matches(pathname, item.href));
            const open = openDesktopMenu === group.label;
            return <div className="relative" key={group.label}>
              <button aria-expanded={open} className={`flex h-10 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold transition ${active ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"}`} onClick={() => setOpenDesktopMenu(open ? null : group.label)} type="button">{group.label}<ChevronDown className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} size={15}/></button>
              {open && <div className="absolute right-0 top-[calc(100%+0.65rem)] z-50 w-[21rem] overflow-hidden rounded-2xl border border-white/10 bg-popover/98 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.5)] backdrop-blur-2xl"><p className="px-3 pb-2 pt-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{group.label}</p><div className="space-y-1">{group.items.map((item) => <NavigationItem item={item} active={itemMatches(pathname, item.href)} key={item.href}/>)}</div></div>}
            </div>;
          })}
        </nav>
        <button aria-expanded={mobileOpen} aria-label="Mở menu điều hướng" className="grid size-11 shrink-0 place-items-center rounded-xl border bg-card text-foreground shadow-sm transition hover:border-primary/50 hover:text-primary xl:hidden" onClick={() => setMobileOpen(true)} type="button"><Menu size={21}/></button>
      </div>
    </header>

    {mobileOpen && <div className="fixed inset-0 z-[60] xl:hidden">
      <button aria-label="Đóng menu" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} type="button"/>
      <aside aria-label="Điều hướng mobile" className="absolute inset-y-0 right-0 flex w-[min(90vw,25rem)] flex-col border-l border-white/10 bg-background shadow-2xl">
        <div className="flex h-[4.5rem] items-center justify-between border-b px-5"><Brand compact/><button aria-label="Đóng menu điều hướng" className="grid size-10 place-items-center rounded-xl bg-secondary text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)} type="button"><X size={20}/></button></div>
        <nav className="flex-1 overflow-y-auto overscroll-contain p-4">
          <Link className={`mb-2 flex min-h-12 items-center gap-3 rounded-xl px-3.5 font-semibold ${pathname === "/" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`} href="/"><LayoutDashboard size={19}/>Tổng quan</Link>
          <div className="space-y-2">{navigation.map((group) => {
            const active = group.items.some((item) => matches(pathname, item.href));
            const open = openMobileGroup === group.label || (openMobileGroup === null && active);
            return <section className="rounded-2xl border bg-card/55 p-1.5" key={group.label}><button aria-expanded={open} className={`flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-sm font-bold ${active ? "text-primary" : ""}`} onClick={() => setOpenMobileGroup(open ? "" : group.label)} type="button"><span>{group.label}</span><ChevronDown className={`transition-transform ${open ? "rotate-180" : ""}`} size={16}/></button>{open && <div className="space-y-1 pb-1">{group.items.map((item) => <NavigationItem item={item} active={itemMatches(pathname, item.href)} key={item.href}/>)}</div>}</section>;
          })}</div>
        </nav>
        <div className="border-t p-5 text-xs leading-5 text-muted-foreground"><strong className="block text-foreground">PACE Smart Campus 181</strong>Network planning workspace</div>
      </aside>
    </div>}
    <main className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">{children}</main>
  </div>;
}

function Brand({ compact = false }: { compact?: boolean }) { return <Link className="group min-w-0 shrink-0" href="/"><span className="block truncate text-[10px] font-bold uppercase tracking-[0.25em] text-primary sm:text-xs">PACE Smart Campus 181</span><span className={`mt-1 block truncate font-bold tracking-tight ${compact ? "text-sm" : "text-base sm:text-lg"}`}>Network Digital Twin</span></Link>; }
function DesktopHomeLink({ pathname }: { pathname: string }) { return <Link className={`flex h-10 items-center rounded-xl px-4 text-sm font-bold transition ${pathname === "/" ? "bg-primary text-primary-foreground shadow-lg shadow-primary/15" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"}`} href="/">Tổng quan</Link>; }
function NavigationItem({ item, active }: { item: (typeof navigation)[number]["items"][number]; active: boolean }) {
  const Icon = item.icon;
  return <Link className={`group flex min-h-[3.65rem] items-center gap-3 rounded-xl px-3 py-2.5 transition ${active ? "bg-primary/12 text-primary" : "hover:bg-secondary/80"}`} href={item.href}><span className={`grid size-9 shrink-0 place-items-center rounded-lg ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground group-hover:text-primary"}`}><Icon size={17}/></span><span className="min-w-0"><span className="block text-sm font-bold">{item.label}</span><span className="mt-0.5 block text-xs leading-4 text-muted-foreground">{item.description}</span></span></Link>;
}
