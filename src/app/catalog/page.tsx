import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { CreateModelForm } from "@/components/catalog/create-model-form";
import { EditCatalogModelButton } from "@/components/catalog/edit-model-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeviceCategory } from "@/generated/prisma/enums";
import { getInventoryOptions } from "@/server/services/inventoryService";
import { listCatalog } from "@/server/services/catalogService";

export const dynamic = "force-dynamic";

interface CatalogPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const query = await searchParams;
  const search = first(query.search);
  const vendorId = first(query.vendorId);
  const categoryValue = first(query.category);
  const category = Object.values(DeviceCategory).find(
    (item) => item === categoryValue,
  );
  const [models, options] = await Promise.all([
    listCatalog({ search, vendorId, category }),
    getInventoryOptions(),
  ]);

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            M1
          </p>
          <h1 className="mt-2 text-4xl font-bold">Device Catalog</h1>
          <p className="mt-3 text-muted-foreground">
            Vendor specs luôn kèm evidence và trạng thái xác minh. Custom model
            được đánh dấu USER_CONFIRMED.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filter catalog</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-4">
              <input
                className="rounded-md border bg-background p-2"
                defaultValue={search}
                name="search"
                placeholder="Search SKU/model"
              />
              <select
                className="rounded-md border bg-background p-2"
                defaultValue={vendorId}
                name="vendorId"
              >
                <option value="">All vendors</option>
                {options.vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border bg-background p-2"
                defaultValue={category}
                name="category"
              >
                <option value="">All categories</option>
                {Object.values(DeviceCategory).map((item) => (
                  <option key={item} value={item}>
                    {item}
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

        <section
          aria-label="Catalog models"
          className="grid items-stretch gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
        >
          {models.map((model) => (
            <Card className="h-full gap-4 py-4" key={model.id}>
              <CardHeader className="gap-3 px-4">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <p className="truncate text-xs font-semibold text-primary" title={model.vendor.name}>
                    {model.vendor.name}
                  </p>
                  <span className="shrink-0 rounded-full border px-2 py-1 text-[9px] font-bold leading-none">
                    {model.specStatus}
                  </span>
                </div>
                <div className="min-w-0">
                  <CardTitle className="line-clamp-2 min-h-10 text-base leading-5" title={model.modelName}>
                    {model.modelName}
                  </CardTitle>
                  <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground" title={model.sku}>
                    {model.sku}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4 px-4">
                <dl className="grid grid-cols-2 gap-x-3 gap-y-3 border-t pt-3 text-xs">
                  <div className="min-w-0">
                    <dt className="text-[10px] text-muted-foreground">Category</dt>
                    <dd className="mt-0.5 truncate font-semibold" title={model.category}>{model.category}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-muted-foreground">Ports</dt>
                    <dd className="mt-0.5 font-semibold">
                      {model.portProfiles.reduce(
                        (sum, item) => sum + item.count,
                        0,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-muted-foreground">Instances</dt>
                    <dd className="mt-0.5 font-semibold">{model._count.instances}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-muted-foreground">Switching</dt>
                    <dd className="mt-0.5 truncate font-semibold">
                      {model.switchingCapacityGbps
                        ? `${model.switchingCapacityGbps} Gbps`
                        : "Unknown"}
                    </dd>
                  </div>
                  <div className="col-span-2 rounded-lg bg-secondary/45 px-3 py-2">
                    <dt className="text-[10px] text-muted-foreground">Quoted unit price</dt>
                    <dd className="mt-0.5 truncate font-semibold text-primary">
                      {model.unitPriceVnd === null
                        ? "Not priced"
                        : `${new Intl.NumberFormat("vi-VN").format(model.unitPriceVnd)} ₫`}
                    </dd>
                  </div>
                </dl>
                <div className="mt-auto flex gap-2">
                  <Link className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border px-2 py-2 text-xs font-bold transition hover:border-primary/50 hover:bg-primary/10 hover:text-primary" href={`/catalog/${model.id}`}>Detail</Link>
                  {model.isCustom && (
                    <EditCatalogModelButton model={{
                    id: model.id, vendorName: model.vendor.name, sku: model.sku,
                    modelName: model.modelName, category: model.category,
                    formFactor: model.formFactor, rackUnits: model.rackUnits,
                    switchingCapacityGbps: model.switchingCapacityGbps,
                    firewallGbps: model.firewallGbps, managementOs: model.managementOs,
                    sourceUrl: model.sourceUrl, supportsLacp: model.supportsLacp,
                    supportsMlag: model.supportsMlag, supportsStacking: model.supportsStacking,
                    supportsHa: model.supportsHa,
                    portProfiles: model.portProfiles.map((profile) => ({
                      portGroup: profile.portGroup, count: profile.count, media: profile.media,
                      supportedSpeedsMbps: profile.supportedSpeedsMbps,
                      poeStandard: profile.poeStandard, roleHint: profile.roleHint,
                      breakoutCapable: profile.breakoutCapable, namePrefix: profile.namePrefix,
                      startNumber: profile.startNumber, sortOrder: profile.sortOrder,
                    })),
                    }}/>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Create Custom Model</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateModelForm vendors={options.vendors} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
