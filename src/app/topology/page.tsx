import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getInventoryOptions } from "@/server/services/inventoryService";

export const dynamic = "force-dynamic";

export default async function TopologyIndexPage() {
  const { scenarios } = await getInventoryOptions();
  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            M2
          </p>
          <h1 className="mt-2 text-4xl font-bold">Network Topology</h1>
          <p className="mt-3 text-muted-foreground">
            Chọn scenario để mở graph port-first được lưu trong database.
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
                  href={`/topology/${scenario.id}`}
                >
                  Open topology →
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
