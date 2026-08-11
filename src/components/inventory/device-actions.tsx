"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

interface DeviceActionsProps {
  deviceId: string;
  scenarioId: string;
  locked: boolean;
  currentStatus: string;
}

export function DeviceActions({
  deviceId,
  scenarioId,
  locked,
  currentStatus,
}: DeviceActionsProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function updateStatus(status: string) {
    const response = await fetch(
      `/api/inventory/${encodeURIComponent(deviceId)}?scenarioId=${encodeURIComponent(scenarioId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    );
    const result = (await response.json()) as {
      errors?: Array<{ message: string }>;
    };
    setMessage(
      response.ok
        ? "Đã cập nhật trạng thái."
        : (result.errors?.[0]?.message ?? "Update failed."),
    );
    if (response.ok) router.refresh();
  }

  async function deleteDevice() {
    if (!window.confirm("Xóa device này khỏi scenario?")) return;
    const response = await fetch(
      `/api/inventory/${encodeURIComponent(deviceId)}?scenarioId=${encodeURIComponent(scenarioId)}`,
      { method: "DELETE" },
    );
    if (response.ok) {
      router.push(`/inventory?scenarioId=${encodeURIComponent(scenarioId)}`);
      router.refresh();
      return;
    }
    const result = (await response.json()) as {
      errors?: Array<{ message: string }>;
    };
    setMessage(result.errors?.[0]?.message ?? "Delete failed.");
  }

  if (locked) {
    return (
      <p className="text-sm text-muted-foreground">
        Baseline đang khóa; mutation bị vô hiệu hóa.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="grid gap-1 text-sm">
        Status
        <select
          className="rounded-md border bg-background p-2"
          defaultValue={currentStatus}
          onChange={(event) => void updateStatus(event.target.value)}
        >
          <option value="PLANNED">Planned</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="MAINTENANCE">Maintenance</option>
          <option value="RETIRED">Retired</option>
        </select>
      </label>
      <Button
        className="mt-5"
        onClick={() => void deleteDevice()}
        type="button"
        variant="destructive"
      >
        Delete device
      </Button>
      <span aria-live="polite" className="mt-5 text-sm text-muted-foreground">
        {message}
      </span>
    </div>
  );
}
