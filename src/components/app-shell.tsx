"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  {
    label: "Thiết kế",
    items: [
      {
        href: "/topology",
        label: "Floor Topology",
        description: "Thiết kế vật lý theo từng tầng",
      },
      {
        href: "/design-wizard",
        label: "Design Wizard",
        description: "Quy trình thiết kế từng bước",
      },
      {
        href: "/network-config",
        label: "LAG / VLAN / IP",
        description: "Cấu hình mạng logical",
      },
      {
        href: "/validation",
        label: "Validation",
        description: "Kiểm tra lỗi và tính sẵn sàng",
      },
    ],
  },
  {
    label: "Tài sản",
    items: [
      {
        href: "/inventory",
        label: "Inventory",
        description: "Thiết bị theo scenario và vị trí",
      },
      {
        href: "/catalog",
        label: "Device Catalog",
        description: "Model, thông số và port profile",
      },
      {
        href: "/costs",
        label: "Project Costs",
        description: "Chi phí thiết bị và tổng đầu tư",
      },
    ],
  },
  {
    label: "Không gian",
    items: [
      {
        href: "/drawings",
        label: "Drawings",
        description: "Bản vẽ, floor map và spatial editor",
      },
    ],
  },
  {
    label: "Kịch bản",
    items: [
      {
        href: "/scenarios",
        label: "Scenario Lab",
        description: "Clone và mô phỏng sự cố",
      },
      {
        href: "/scenarios/compare",
        label: "Scenario Compare",
        description: "So sánh thiết bị, rủi ro và chi phí",
      },
    ],
  },
];

function matches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function itemMatches(pathname: string, href: string) {
  return href === "/scenarios" ? pathname === href : matches(pathname, href);
}

export function AppShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <Link className="shrink-0" href="/">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              PACE Smart Campus 181
            </p>
            <p className="mt-1 font-semibold">Network Digital Twin</p>
          </Link>
          <nav
            aria-label="Điều hướng chính"
            className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:overflow-visible lg:pb-0"
          >
            <Link
              className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition ${pathname === "/" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
              href="/"
            >
              Tổng quan
            </Link>
            {navigation.map((group) => {
              const active = group.items.some((item) =>
                matches(pathname, item.href),
              );
              return (
                <details className="group relative shrink-0" key={group.label}>
                  <summary
                    className={`flex cursor-pointer list-none items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold transition [&::-webkit-details-marker]:hidden ${active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
                  >
                    {group.label}
                    <ChevronDown
                      className="transition group-open:rotate-180"
                      size={15}
                    />
                  </summary>
                  <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 min-w-72 rounded-xl border bg-card p-1.5 shadow-2xl">
                    <p className="px-3 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                      {group.label}
                    </p>
                    {group.items.map((item) => (
                      <Link
                        className={`block rounded-lg px-3 py-2.5 transition ${itemMatches(pathname, item.href) ? "bg-primary/15" : "hover:bg-secondary"}`}
                        href={item.href}
                        key={item.href}
                        onClick={(event) =>
                          event.currentTarget
                            .closest("details")
                            ?.removeAttribute("open")
                        }
                      >
                        <span
                          className={`block text-sm font-bold ${itemMatches(pathname, item.href) ? "text-primary" : ""}`}
                        >
                          {item.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {item.description}
                        </span>
                      </Link>
                    ))}
                  </div>
                </details>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
    </div>
  );
}
