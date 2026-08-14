import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getProjectCostSummary,
  listCostScenarios,
} from "@/server/services/projectCostService";

export const dynamic = "force-dynamic";

function formatVnd(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value) + " ₫";
}

export default async function ProjectCostsPage({
  searchParams,
}: {
  searchParams: Promise<{ scenarioId?: string }>;
}) {
  const scenarios = await listCostScenarios();
  const query = await searchParams;
  const scenarioId =
    query.scenarioId ??
    scenarios.find((scenario) => scenario.type === "PROPOSED")?.id ??
    scenarios[0]?.id ??
    "";
  const summary = await getProjectCostSummary(scenarioId);
  const maxCategory = Math.max(
    ...summary.categories.map((category) => category.totalVnd),
    1,
  );

  return (
    <AppShell>
      <div className="space-y-8">
        <header className="overflow-hidden rounded-3xl border bg-gradient-to-br from-emerald-950 via-slate-950 to-slate-900 p-7 text-white shadow-2xl md:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-300">
                Project investment cockpit
              </p>
              <h1 className="mt-3 text-4xl font-bold md:text-5xl">
                {summary.scenario.name}
              </h1>
              <p className="mt-3 max-w-2xl text-slate-300">
                Tổng mức đầu tư được tính trực tiếp từ inventory và báo giá.
                Thay model hoặc số lượng thiết bị, dashboard sẽ cập nhật khi dữ
                liệu được refresh.
              </p>
            </div>
            <form className="flex gap-2">
              <select
                className="min-w-64 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white backdrop-blur"
                defaultValue={scenarioId}
                name="scenarioId"
              >
                {scenarios.map((scenario) => (
                  <option
                    className="text-slate-950"
                    key={scenario.id}
                    value={scenario.id}
                  >
                    {scenario.name}
                  </option>
                ))}
              </select>
              <button className="rounded-xl bg-emerald-400 px-5 py-3 font-bold text-emerald-950">
                View
              </button>
            </form>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Tổng sau VAT", formatVnd(summary.totalVnd), "text-emerald-300"],
              ["Trước VAT", formatVnd(summary.subtotalVnd), "text-white"],
              ["VAT", formatVnd(summary.vatVnd), "text-amber-300"],
              ["Thiết bị", `${summary.deviceCount} units`, "text-sky-300"],
            ].map(([label, value, color]) => (
              <div
                className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"
                key={label}
              >
                <p className="text-sm text-slate-400">{label}</p>
                <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.6fr]">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Cost composition</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {summary.categories.map((category) => (
                <div key={category.category}>
                  <div className="mb-2 flex justify-between gap-4 text-sm">
                    <span className="font-semibold">
                      {category.category.replaceAll("_", " ")}
                    </span>
                    <span>{formatVnd(category.totalVnd)}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400"
                      style={{
                        width: `${Math.max((category.totalVnd / maxCategory) * 100, 2)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
              <div className="rounded-xl border bg-secondary/40 p-4 text-sm">
                <p className="font-semibold">Pricing coverage</p>
                <p className="mt-1 text-muted-foreground">
                  {summary.pricedDeviceCount}/{summary.deviceCount} devices
                  priced
                  {summary.unpricedDeviceCount > 0
                    ? ` · ${summary.unpricedDeviceCount} missing price`
                    : " · complete"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Executive summary</CardTitle>
              <Link
                className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-accent"
                href={`/inventory?scenarioId=${scenarioId}`}
              >
                Change inventory →
              </Link>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-2xl text-left text-sm">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="pb-3">Item</th>
                    <th>Type</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Unit price</th>
                    <th className="text-right">After VAT</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.lines.map((line) => (
                    <tr className="border-t" key={`${line.kind}:${line.code}`}>
                      <td className="py-3">
                        <p className="font-semibold">{line.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {line.code}
                        </p>
                      </td>
                      <td>
                        {line.kind === "DEVICE" ? "Device" : line.category}
                      </td>
                      <td className="text-right">{line.quantity}</td>
                      <td className="text-right">
                        {line.unitCostVnd === null
                          ? "Missing"
                          : formatVnd(line.unitCostVnd)}
                      </td>
                      <td className="text-right font-semibold">
                        {formatVnd(line.totalVnd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 text-base font-bold">
                    <td className="pt-4" colSpan={4}>
                      Project total
                    </td>
                    <td className="pt-4 text-right text-emerald-600">
                      {formatVnd(summary.totalVnd)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
