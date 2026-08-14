"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
type Preview = {
  summary: {
    currentModel: { modelName: string; unitPriceVnd: number | null };
    targetModel: { modelName: string; unitPriceVnd: number | null };
    currentPortCount: number;
    targetPortCount: number;
  };
  mapping: { mappings: unknown[]; unmapped: Array<{ name: string }> };
  findings: Array<{ severity: string; ruleCode: string; message: string }>;
};
export function ModelSwap({
  deviceId,
  scenarioId,
  currentModelId,
  models,
  locked,
}: {
  deviceId: string;
  scenarioId: string;
  currentModelId: string;
  models: Array<{ id: string; sku: string; modelName: string }>;
  locked: boolean;
}) {
  const router = useRouter();
  const [targetModelId, setTargetModelId] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState("");
  const formatVnd = (value: number) =>
    new Intl.NumberFormat("vi-VN").format(value) + " ₫";
  async function request(path: string, commitWithWarnings = false) {
    setMessage("");
    const response = await fetch(`/api/devices/${deviceId}/swap-model${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenarioId, targetModelId, commitWithWarnings }),
    });
    const payload = (await response.json()) as {
      data?: Preview;
      error?: { message?: string };
    };
    if (!response.ok) {
      setMessage(payload.error?.message ?? "Model swap failed.");
      return;
    }
    if (path === "/preview") setPreview(payload.data ?? null);
    else {
      setMessage("Model swap committed.");
      setPreview(null);
      router.refresh();
    }
  }
  return (
    <div className="space-y-3">
      <select
        className="w-full rounded border bg-background p-2"
        disabled={locked}
        onChange={(event) => {
          setTargetModelId(event.target.value);
          setPreview(null);
        }}
        value={targetModelId}
      >
        <option value="">Choose target model</option>
        {models
          .filter((model) => model.id !== currentModelId)
          .map((model) => (
            <option key={model.id} value={model.id}>
              {model.sku} · {model.modelName}
            </option>
          ))}
      </select>
      <button
        className="rounded bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50"
        disabled={locked || !targetModelId}
        onClick={() => request("/preview")}
      >
        Preview model swap
      </button>
      {preview && (
        <div className="space-y-2 rounded border p-3 text-sm">
          <b>
            {preview.summary.currentModel.modelName} →{" "}
            {preview.summary.targetModel.modelName}
          </b>
          <p>
            Ports: {preview.summary.currentPortCount} →{" "}
            {preview.summary.targetPortCount}; mapped{" "}
            {preview.mapping.mappings.length}; unmapped{" "}
            {preview.mapping.unmapped.length}
          </p>
          <p className="rounded bg-secondary p-2 font-semibold">
            Cost impact:{" "}
            {preview.summary.currentModel.unitPriceVnd === null ||
            preview.summary.targetModel.unitPriceVnd === null
              ? "Missing model price"
              : `${formatVnd(preview.summary.currentModel.unitPriceVnd)} → ${formatVnd(preview.summary.targetModel.unitPriceVnd)} (${formatVnd(preview.summary.targetModel.unitPriceVnd - preview.summary.currentModel.unitPriceVnd)})`}
          </p>
          {preview.findings.map((finding) => (
            <p
              key={`${finding.ruleCode}-${finding.message}`}
              className={
                finding.severity === "ERROR"
                  ? "text-destructive"
                  : "text-amber-400"
              }
            >
              {finding.severity} · {finding.ruleCode}: {finding.message}
            </p>
          ))}
          <button
            className="rounded border px-3 py-2 font-semibold"
            onClick={() => request("", preview.findings.length > 0)}
          >
            Commit {preview.findings.length ? "with findings" : "swap"}
          </button>
        </div>
      )}
      {message && <p className="text-sm">{message}</p>}
    </div>
  );
}
