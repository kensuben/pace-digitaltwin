"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function ValidationPanel({
  scenarioId,
  initial,
}: {
  scenarioId: string;
  initial: Array<{
    id: string;
    severity: string;
    ruleCode: string;
    entityType: string;
    entityId: string;
    message: string;
    remediation: string | null;
  }>;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  async function run() {
    setRunning(true);
    await fetch(`/api/scenarios/${scenarioId}/validation`, { method: "POST" });
    setRunning(false);
    router.refresh();
  }
  function href(finding: (typeof initial)[number]) {
    if (finding.entityType === "DeviceInstance")
      return `/inventory/${finding.entityId}?scenarioId=${scenarioId}`;
    return `/topology/${scenarioId}?entityId=${finding.entityId}`;
  }
  return (
    <div className="space-y-4">
      <button
        className="rounded bg-primary px-4 py-2 font-semibold text-primary-foreground"
        disabled={running}
        onClick={run}
      >
        {running ? "Validating…" : "Run validation"}
      </button>
      <div className="space-y-3">
        {initial.map((finding) => (
          <article className="rounded-lg border bg-card p-4" key={finding.id}>
            <div className="flex justify-between gap-4">
              <b>
                {finding.severity} · {finding.ruleCode}
              </b>
              <a className="text-primary hover:underline" href={href(finding)}>
                Locate →
              </a>
            </div>
            <p className="mt-2">{finding.message}</p>
            {finding.remediation && (
              <p className="mt-1 text-sm text-muted-foreground">
                {finding.remediation}
              </p>
            )}
          </article>
        ))}
        {!initial.length && (
          <p className="rounded-lg border bg-card p-4 text-muted-foreground">
            No persisted findings. Run validation.
          </p>
        )}
      </div>
    </div>
  );
}
