import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  compareScenarios,
  listScenarios,
} from "@/server/services/scenarioService";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ leftId?: string; rightId?: string }>;
}) {
  const { leftId = "", rightId = "" } = await searchParams;
  const scenarios = await listScenarios();
  const scenarioIds = new Set(scenarios.map((scenario) => scenario.id));
  const hasValidSelection = scenarioIds.has(leftId) && scenarioIds.has(rightId);
  const result = hasValidSelection
    ? await compareScenarios(leftId, rightId)
    : null;

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <Link
            className="text-sm font-semibold text-primary"
            href="/scenarios"
          >
            ← Scenario lab
          </Link>
          <h1 className="mt-3 text-4xl font-bold">So sánh phương án</h1>
          <p className="mt-2 text-muted-foreground">
            {result
              ? `${result.left.name} → ${result.right.name}`
              : "Chọn hai phương án để phân tích chênh lệch thiết bị, kết nối và chi phí."}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Chọn phương án so sánh</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"
              method="get"
            >
              <ScenarioSelect
                defaultValue={scenarioIds.has(leftId) ? leftId : ""}
                label="Phương án gốc"
                name="leftId"
                scenarios={scenarios}
              />
              <ScenarioSelect
                defaultValue={scenarioIds.has(rightId) ? rightId : ""}
                label="Phương án đối chiếu"
                name="rightId"
                scenarios={scenarios}
              />
              <button
                className="self-end rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                disabled={scenarios.length === 0}
                type="submit"
              >
                So sánh
              </button>
            </form>
            {!hasValidSelection && (leftId || rightId) && (
              <p className="mt-3 text-sm text-amber-400">
                Vui lòng chọn đủ hai phương án hợp lệ.
              </p>
            )}
          </CardContent>
        </Card>

        {result && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Metric
                label="Chênh lệch chi phí"
                value={signedMoney(result.costDeltaVnd)}
              />
              <Metric
                label="Chênh lệch thiết bị"
                value={result.right.deviceCount - result.left.deviceCount}
              />
              <Metric
                label="Chênh lệch liên kết"
                value={result.right.linkCount - result.left.linkCount}
              />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <ChangeCard
                items={result.deviceChanges.added}
                title="Thiết bị thêm"
              />
              <ChangeCard
                items={result.deviceChanges.removed}
                title="Thiết bị loại bỏ"
              />
              <ChangeCard
                items={result.deviceChanges.replaced.map(
                  (device) =>
                    `${device.hostname}: ${device.from} → ${device.to}`,
                )}
                title="Thiết bị thay thế"
              />
              <ChangeCard
                items={[
                  ...result.linkChanges.added.map((item) => `+ ${item}`),
                  ...result.linkChanges.removed.map((item) => `− ${item}`),
                ]}
                title="Thay đổi liên kết"
              />
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Validation delta</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                {["ERROR", "WARNING", "INFO"].map((key) => (
                  <div className="rounded-lg bg-secondary p-4" key={key}>
                    <p className="text-xs text-muted-foreground">{key}</p>
                    <p className="mt-1 text-2xl font-bold">
                      {(result.right.findings[key] ?? 0) -
                        (result.left.findings[key] ?? 0)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}

function ScenarioSelect({
  defaultValue,
  label,
  name,
  scenarios,
}: {
  defaultValue: string;
  label: string;
  name: string;
  scenarios: Array<{ id: string; name: string }>;
}) {
  return (
    <label className="space-y-2 text-sm font-medium">
      <span>{label}</span>
      <select
        className="w-full rounded-lg border bg-background px-3 py-3"
        defaultValue={defaultValue}
        name={name}
        required
      >
        <option disabled value="">
          Chọn phương án…
        </option>
        {scenarios.map((scenario) => (
          <option key={scenario.id} value={scenario.id}>
            {scenario.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function signedMoney(value: number) {
  return `${value > 0 ? "+" : ""}${money.format(value)}`;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function ChangeCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {title} <span className="text-primary">({items.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length ? (
          <ul className="space-y-2 text-sm">
            {items.map((item) => (
              <li className="rounded-md bg-secondary px-3 py-2" key={item}>
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Không có thay đổi.</p>
        )}
      </CardContent>
    </Card>
  );
}
