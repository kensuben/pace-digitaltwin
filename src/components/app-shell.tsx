import Link from "next/link";

const navigation = [
  { href: "/", label: "Overview" },
  { href: "/inventory", label: "Inventory" },
  { href: "/catalog", label: "Device Catalog" },
  { href: "/topology", label: "Topology" },
  { href: "/drawings", label: "Drawings" },
];

export function AppShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              PACE Smart Campus 181
            </p>
            <p className="mt-1 font-semibold">Network Digital Twin</p>
          </div>
          <nav aria-label="Điều hướng chính" className="flex flex-wrap gap-2">
            {navigation.map((item) => (
              <Link
                className="rounded-md border bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground hover:bg-accent"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
    </div>
  );
}
