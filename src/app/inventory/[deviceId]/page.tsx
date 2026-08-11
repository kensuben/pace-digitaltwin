import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { DeviceActions } from "@/components/inventory/device-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppError } from "@/server/errors";
import { getInventoryDevice } from "@/server/services/inventoryService";

export const dynamic = "force-dynamic";

interface DevicePageProps {
  params: Promise<{ deviceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DevicePage({
  params,
  searchParams,
}: DevicePageProps) {
  const [{ deviceId }, query] = await Promise.all([params, searchParams]);
  const scenarioValue = query.scenarioId;
  const scenarioId = Array.isArray(scenarioValue)
    ? scenarioValue[0]
    : scenarioValue;
  if (!scenarioId) notFound();
  const device = await getInventoryDevice(scenarioId, deviceId).catch(
    (error: unknown) => {
      if (error instanceof AppError && error.status === 404) notFound();
      throw error;
    },
  );

  return (
    <AppShell>
      <div className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <Link
              className="text-sm text-primary hover:underline"
              href={`/inventory?scenarioId=${scenarioId}`}
            >
              ← Inventory
            </Link>
            <h1 className="mt-3 text-4xl font-bold">{device.hostname}</h1>
            <p className="mt-2 text-muted-foreground">
              {device.displayName} · {device.scenario.name}
              {device.scenario.isLocked ? " · Locked" : ""}
            </p>
          </div>
          <Button disabled title="Model Swap thuộc M4">
            Change Model — M4
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Model</dt>
                  <dd>
                    {device.model.vendor.name} {device.model.modelName}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Category</dt>
                  <dd>{device.model.category}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Location</dt>
                  <dd>
                    {device.building.code} / {device.floor.code}
                    {device.zone ? ` / ${device.zone.code}` : ""}
                    {device.rack ? ` / ${device.rack.code}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Rack unit</dt>
                  <dd>{device.rackUnitStart ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Management IP</dt>
                  <dd>{device.managementIp ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Asset / serial</dt>
                  <dd>
                    {device.assetTag ?? "—"} / {device.serialNumber ?? "—"}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Mutation</CardTitle>
            </CardHeader>
            <CardContent>
              <DeviceActions
                currentStatus={device.status}
                deviceId={device.id}
                locked={device.scenario.isLocked}
                scenarioId={device.scenarioId}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ports ({device.ports.length})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-3xl text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="pb-3">Index</th>
                  <th>Name</th>
                  <th>Media</th>
                  <th>Supported speeds</th>
                  <th>Admin</th>
                  <th>Operational</th>
                </tr>
              </thead>
              <tbody>
                {device.ports.map((port) => (
                  <tr className="border-t" key={port.id}>
                    <td className="py-3">{port.index}</td>
                    <td className="font-medium">{port.name}</td>
                    <td>{port.media}</td>
                    <td>
                      {port.supportedSpeedsMbps
                        .map((speed) => `${speed} Mbps`)
                        .join(", ")}
                    </td>
                    <td>{port.adminStatus}</td>
                    <td>{port.operationalStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Deferred detail sections</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Links thuộc M2; LAG/VLAN thuộc M3; Model Swap và audit transaction
            thuộc M4.
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
