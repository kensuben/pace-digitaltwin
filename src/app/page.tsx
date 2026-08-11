import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

const foundations = [
  "Next.js 16 + TypeScript strict",
  "PostgreSQL + Prisma ORM 7",
  "Docker và GitHub Actions",
  "Route → Service → Repository",
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-16">
      <Card className="w-full rounded-3xl bg-card/90 p-2 shadow-2xl md:p-8">
        <CardHeader>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-primary">
            PACE Smart Campus 181
          </p>
          <CardTitle>
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-6xl">
              Network Digital Twin
            </h1>
          </CardTitle>
          <CardDescription className="mt-4 max-w-3xl text-lg leading-8">
            Nền tảng M0.1 đã sẵn sàng. Các module Catalog, Inventory và Topology
            sẽ được bổ sung theo roadmap tích hợp của SOP-SC181-001 và
            SOP-SC181-002.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul
            className="grid gap-4 md:grid-cols-2"
            aria-label="Nền tảng kỹ thuật"
          >
            {foundations.map((foundation) => (
              <li
                className="rounded-2xl border bg-secondary p-5 text-secondary-foreground"
                key={foundation}
              >
                <span aria-hidden="true" className="mr-3 text-primary">
                  ✓
                </span>
                {foundation}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              href="/inventory"
            >
              Open Inventory
            </Link>
            <Link
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
              href="/catalog"
            >
              Open Device Catalog
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
