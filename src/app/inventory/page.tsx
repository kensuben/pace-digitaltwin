import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { CreateDeviceDialog } from "@/components/inventory/create-device-dialog";
import { type LocationOption } from "@/components/inventory/create-device-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeviceCategory, DeviceStatus } from "@/generated/prisma/enums";
import {
  getInventoryOptions,
  listInventory,
  parseInventoryFilters,
} from "@/server/services/inventoryService";

export const dynamic = "force-dynamic";

interface InventoryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function InventoryPage({
  searchParams,
}: InventoryPageProps) {
  const query = await searchParams;
  const values = {
    scenarioId: first(query.scenarioId),
    search: first(query.search),
    category: first(query.category),
    status: first(query.status),
  };
  const [devices, options] = await Promise.all([
    listInventory(parseInventoryFilters(values)),
    getInventoryOptions(),
  ]);
  const pageSize = 50;
  const requestedPage = Number(first(query.page) ?? "1");
  const totalPages = Math.max(1, Math.ceil(devices.length / pageSize));
  const currentPage = Math.min(
    Math.max(Number.isFinite(requestedPage) ? Math.trunc(requestedPage) : 1, 1),
    totalPages,
  );
  const visibleDevices = devices.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) if (value) params.set(key, value);
    params.set("page", String(page));
    return `/inventory?${params.toString()}`;
  };
  const locations: LocationOption[] = [];
  for (const building of options.buildings) {
    for (const floor of building.floors) {
      if (floor.zones.length === 0) {
        locations.push({
          key: `${building.id}:${floor.id}`,
          label: `${building.code} / ${floor.code}`,
          buildingId: building.id,
          floorId: floor.id,
          zoneId: null,
          rackId: null,
        });
        continue;
      }
      for (const zone of floor.zones) {
        locations.push({
          key: `${building.id}:${floor.id}:${zone.id}`,
          label: `${building.code} / ${floor.code} / ${zone.code}`,
          buildingId: building.id,
          floorId: floor.id,
          zoneId: zone.id,
          rackId: null,
        });
        for (const rack of zone.racks) {
          locations.push({
            key: `${building.id}:${floor.id}:${zone.id}:${rack.id}`,
            label: `${building.code} / ${floor.code} / ${zone.code} / ${rack.code}`,
            buildingId: building.id,
            floorId: floor.id,
            zoneId: zone.id,
            rackId: rack.id,
          });
        }
      }
    }
  }

  return (
    <AppShell>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              M1
            </p>
            <h1 className="mt-2 text-4xl font-bold">Inventory</h1>
            <p className="mt-3 text-muted-foreground">
              Administrative location và scenario ownership là nguồn sự thật;
              mỗi device sinh port từ catalog profile.
            </p>
          </div>
          <CreateDeviceDialog
            locations={locations}
            models={options.models}
            scenarios={options.scenarios}
            vendors={options.vendors}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filter inventory</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-5">
              <input
                className="rounded-md border bg-background p-2"
                defaultValue={values.search}
                name="search"
                placeholder="Hostname/model"
              />
              <select
                className="rounded-md border bg-background p-2"
                defaultValue={values.scenarioId}
                name="scenarioId"
              >
                <option value="">All scenarios</option>
                {options.scenarios.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border bg-background p-2"
                defaultValue={values.category}
                name="category"
              >
                <option value="">All categories</option>
                {Object.values(DeviceCategory).map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border bg-background p-2"
                defaultValue={values.status}
                name="status"
              >
                <option value="">All statuses</option>
                {Object.values(DeviceStatus).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <button
                className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground"
                type="submit"
              >
                Apply
              </button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>{devices.length} devices</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Trang {currentPage}/{totalPages} · tối đa {pageSize} thiết bị mỗi trang</p>
            </div>
            <div className="flex gap-2">
              {currentPage > 1 && <Link className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-secondary" href={pageHref(currentPage - 1)}>← Trước</Link>}
              {currentPage < totalPages && <Link className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-secondary" href={pageHref(currentPage + 1)}>Sau →</Link>}
            </div>
          </CardHeader>
          <CardContent>
            <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[64rem] text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="pb-3">Hostname</th>
                  <th>Category</th>
                  <th>Vendor / Model</th>
                  <th>Location</th>
                  <th>Management IP</th>
                  <th>Status</th>
                  <th>Scenario</th>
                </tr>
              </thead>
              <tbody>
                {visibleDevices.map((device) => (
                  <tr
                    className="border-t"
                    key={`${device.scenarioId}:${device.id}`}
                  >
                    <td className="py-4 font-semibold">
                      <Link
                        className="text-primary hover:underline"
                        href={`/inventory/${device.id}?scenarioId=${device.scenarioId}`}
                      >
                        {device.hostname}
                      </Link>
                    </td>
                    <td>{device.model.category}</td>
                    <td>
                      {device.model.vendor.name} / {device.model.modelName}
                    </td>
                    <td>
                      {device.building.code} / {device.floor.code}
                      {device.rack ? ` / ${device.rack.code}` : ""}
                    </td>
                    <td>{device.managementIp ?? "—"}</td>
                    <td>{device.status}</td>
                    <td>
                      {device.scenario.name}
                      {device.scenario.isLocked ? " 🔒" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <div className="grid gap-3 md:hidden">
              {visibleDevices.map((device) => (
                <article className="rounded-xl border bg-background/45 p-4" key={`${device.scenarioId}:${device.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><Link className="block truncate font-mono text-sm font-bold text-primary" href={`/inventory/${device.id}?scenarioId=${device.scenarioId}`}>{device.hostname}</Link><p className="mt-1 truncate text-xs text-muted-foreground">{device.model.vendor.name} · {device.model.modelName}</p></div>
                    <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">{device.status}</span>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 border-t pt-3 text-xs"><div><dt className="text-muted-foreground">Category</dt><dd className="mt-0.5 font-semibold">{device.model.category}</dd></div><div><dt className="text-muted-foreground">Location</dt><dd className="mt-0.5 font-semibold">{device.building.code} / {device.floor.code}</dd></div><div><dt className="text-muted-foreground">Management IP</dt><dd className="mt-0.5 font-mono">{device.managementIp ?? "—"}</dd></div><div><dt className="text-muted-foreground">Scenario</dt><dd className="mt-0.5 font-semibold">{device.scenario.name}{device.scenario.isLocked ? " 🔒" : ""}</dd></div></dl>
                </article>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
