import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import {
  CreateDeviceForm,
  type LocationOption,
} from "@/components/inventory/create-device-form";
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
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            M1
          </p>
          <h1 className="mt-2 text-4xl font-bold">Inventory</h1>
          <p className="mt-3 text-muted-foreground">
            Administrative location và scenario ownership là nguồn sự thật; mỗi
            device sinh port từ catalog profile.
          </p>
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
          <CardHeader>
            <CardTitle>{devices.length} devices</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-5xl text-left text-sm">
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
                {devices.map((device) => (
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create Device Instance</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateDeviceForm
              locations={locations}
              models={options.models}
              scenarios={options.scenarios}
            />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
