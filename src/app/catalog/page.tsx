import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { CreateModelForm } from "@/components/catalog/create-model-form";
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
          className="grid gap-5 lg:grid-cols-2"
        >
          {models.map((model) => (
            <Card key={model.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-primary">{model.vendor.name}</p>
                    <CardTitle className="mt-1 text-xl">
                      {model.modelName}
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {model.sku}
                    </p>
                  </div>
                  <span className="rounded-full border px-3 py-1 text-xs font-semibold">
                    {model.specStatus}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Category</dt>
                    <dd>{model.category}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Ports</dt>
                    <dd>
                      {model.portProfiles.reduce(
                        (sum, item) => sum + item.count,
                        0,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Instances</dt>
                    <dd>{model._count.instances}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Switching</dt>
                    <dd>
                      {model.switchingCapacityGbps
                        ? `${model.switchingCapacityGbps} Gbps`
                        : "Unknown"}
                    </dd>
                  </div>
                </dl>
                <Link
                  className="inline-flex rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent"
                  href={`/catalog/${model.id}`}
                >
                  View model detail
                </Link>
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
