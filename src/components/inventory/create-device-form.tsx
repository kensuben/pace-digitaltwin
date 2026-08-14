"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export interface LocationOption {
  key: string;
  label: string;
  buildingId: string;
  floorId: string;
  zoneId: string | null;
  rackId: string | null;
}

interface CreateDeviceFormProps {
  scenarios: Array<{ id: string; name: string; isLocked: boolean }>;
  models: Array<{ id: string; sku: string; modelName: string }>;
  locations: LocationOption[];
  onCreated?: () => void;
  defaultModelId?: string;
}

export function CreateDeviceForm({
  scenarios,
  models,
  locations,
  onCreated,
  defaultModelId,
}: CreateDeviceFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSubmitting(true);
    setMessage("");
    const form = new FormData(formElement);
    const location = locations.find(
      (item) => item.key === form.get("location"),
    );
    if (!location) {
      setMessage("Location không hợp lệ.");
      setSubmitting(false);
      return;
    }
    const response = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenarioId: form.get("scenarioId"),
        hostname: form.get("hostname"),
        displayName: form.get("displayName"),
        modelId: form.get("modelId"),
        managementIp: form.get("managementIp") || null,
        buildingId: location.buildingId,
        floorId: location.floorId,
        zoneId: location.zoneId,
        rackId: location.rackId,
      }),
    });
    const result = (await response.json()) as {
      errors?: Array<{ message: string }>;
    };
    setSubmitting(false);
    if (!response.ok) {
      setMessage(result.errors?.[0]?.message ?? "Không thể tạo device.");
      return;
    }
    formElement.reset();
    setMessage("Đã tạo device và sinh port theo model.");
    router.refresh();
    onCreated?.();
  }

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
      <label className="grid gap-1 text-sm">
        Scenario
        <select
          className="rounded-md border bg-background p-2"
          name="scenarioId"
          required
        >
          {scenarios
            .filter((scenario) => !scenario.isLocked)
            .map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.name}
              </option>
            ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Model
        <select
          className="rounded-md border bg-background p-2"
          defaultValue={defaultModelId}
          name="modelId"
          required
        >
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.modelName} ({model.sku})
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Hostname
        <input
          className="rounded-md border bg-background p-2"
          name="hostname"
          placeholder="ACCESS-T1-01"
          required
        />
      </label>
      <label className="grid gap-1 text-sm">
        Display name
        <input
          className="rounded-md border bg-background p-2"
          name="displayName"
          placeholder="Access Switch Tầng 1"
          required
        />
      </label>
      <label className="grid gap-1 text-sm md:col-span-2">
        Location
        <select
          className="rounded-md border bg-background p-2"
          name="location"
          required
        >
          {locations.map((location) => (
            <option key={location.key} value={location.key}>
              {location.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm md:col-span-2">
        Management IP (metadata only)
        <input
          className="rounded-md border bg-background p-2"
          name="managementIp"
          placeholder="10.0.0.10"
        />
      </label>
      <div className="flex items-center gap-3 md:col-span-2">
        <Button disabled={submitting} type="submit">
          {submitting ? "Đang tạo…" : "Thêm thiết bị"}
        </Button>
        <span aria-live="polite" className="text-sm text-muted-foreground">
          {message}
        </span>
      </div>
    </form>
  );
}
