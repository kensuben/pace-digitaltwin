import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getInventoryOptions } from "@/server/services/inventoryService";
export const dynamic = "force-dynamic";
export default async function NetworkConfigPage() {
  const { scenarios } = await getInventoryOptions();
  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            M3
          </p>
          <h1 className="mt-2 text-4xl font-bold">LAG / VLAN / IP Plan</h1>
          <p className="mt-3 text-muted-foreground">
            Chọn scenario để quản trị toàn bộ cấu hình theo quy trình CRUD.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {scenarios.map((scenario) => (
            <Card key={scenario.id}>
              <CardHeader>
                <CardTitle>
                  {scenario.name} {scenario.isLocked ? "🔒" : ""}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  className="font-semibold text-primary hover:underline"
                  href={`/network-config/${scenario.id}`}
                >
                  Open network config →
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
