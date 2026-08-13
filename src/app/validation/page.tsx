import { AppShell } from "@/components/app-shell";
import { ValidationPanel } from "@/components/validation/validation-panel";
import { getInventoryOptions } from "@/server/services/inventoryService";
import { listValidationFindings } from "@/server/services/validationService";
export const dynamic = "force-dynamic";
export default async function ValidationPage({
  searchParams,
}: {
  searchParams: Promise<{ scenarioId?: string }>;
}) {
  const { scenarios } = await getInventoryOptions();
  const query = await searchParams;
  const scenarioId = query.scenarioId ?? scenarios[0]?.id ?? "";
  const findings = scenarioId
    ? ((await listValidationFindings(scenarioId)) as Array<{
        id: string;
        severity: string;
        ruleCode: string;
        entityType: string;
        entityId: string;
        message: string;
        remediation: string | null;
      }>)
    : [];
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            M4
          </p>
          <h1 className="mt-2 text-4xl font-bold">Validation Findings</h1>
        </div>
        <form>
          <select
            className="rounded border bg-background p-2"
            defaultValue={scenarioId}
            name="scenarioId"
            onChange={undefined}
          >
            {scenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.name}
              </option>
            ))}
          </select>
          <button className="ml-2 rounded border px-3 py-2">Open</button>
        </form>
        {scenarioId && (
          <ValidationPanel initial={findings} scenarioId={scenarioId} />
        )}
      </div>
    </AppShell>
  );
}
