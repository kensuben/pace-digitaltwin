"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { LocationOption } from "@/components/inventory/create-device-form";

interface DeviceActionsProps {
  deviceId: string;
  scenarioId: string;
  locked: boolean;
  currentStatus: string;
  currentHostname: string;
  currentDisplayName: string;
  currentLocationKey: string;
  currentRackUnit: number | null;
  locations: LocationOption[];
}

export function DeviceActions({
  deviceId,
  scenarioId,
  locked,
  currentStatus,
  currentHostname,
  currentDisplayName,
  currentLocationKey,
  currentRackUnit,
  locations,
}: DeviceActionsProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [hostname, setHostname] = useState(currentHostname);
  const [displayName, setDisplayName] = useState(currentDisplayName);
  const [saving, setSaving] = useState(false);
  const [locationKey, setLocationKey] = useState(currentLocationKey);
  const [rackUnit, setRackUnit] = useState(currentRackUnit?.toString() ?? "");

  async function patchDevice(data: Record<string, unknown>) {
    const response = await fetch(
      `/api/inventory/${encodeURIComponent(deviceId)}?scenarioId=${encodeURIComponent(scenarioId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    const result = (await response.json()) as {
      errors?: Array<{ message: string }>;
    };
    if (!response.ok)
      throw new Error(result.errors?.[0]?.message ?? "Update failed.");
  }

  async function updateStatus(status: string) {
    try {
      await patchDevice({ status });
      setMessage("Đã cập nhật trạng thái.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed.");
    }
  }

  async function updateNames(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await patchDevice({ hostname, displayName });
      setHostname(hostname.trim().toUpperCase());
      setMessage("Đã cập nhật tên thiết bị.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không thể cập nhật tên.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateLocation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const location = locations.find((item) => item.key === locationKey);
    if (!location) {
      setMessage("Location không hợp lệ.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await patchDevice({
        buildingId: location.buildingId,
        floorId: location.floorId,
        zoneId: location.zoneId,
        rackId: location.rackId,
        rackUnitStart: rackUnit ? Number(rackUnit) : null,
      });
      setMessage("Đã cập nhật location thiết bị.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không thể cập nhật location.",
      );
    } finally {
      setSaving(false);
    }
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

  return (
    <div className="space-y-5">
      <form className="space-y-3" onSubmit={updateNames}>
        <label className="grid gap-1 text-sm">
          Hostname
          <input
            className="rounded-md border bg-background p-2"
            maxLength={80}
            onChange={(event) => setHostname(event.target.value)}
            required
            value={hostname}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Display name
          <input
            className="rounded-md border bg-background p-2"
            maxLength={160}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            value={displayName}
          />
        </label>
        <Button
          disabled={saving || !hostname.trim() || !displayName.trim()}
          type="submit"
        >
          {saving ? "Đang lưu…" : "Lưu tên thiết bị"}
        </Button>
      </form>
      {!locked && (
        <form className="space-y-3 border-t pt-4" onSubmit={updateLocation}>
          <p className="text-sm font-bold">Location</p>
          <label className="grid gap-1 text-sm">
            Vị trí
            <select
              className="rounded-md border bg-background p-2"
              onChange={(event) => setLocationKey(event.target.value)}
              value={locationKey}
            >
              {locations.map((location) => (
                <option key={location.key} value={location.key}>
                  {location.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Rack unit
            <input
              className="rounded-md border bg-background p-2"
              min="1"
              onChange={(event) => setRackUnit(event.target.value)}
              placeholder="Không gán"
              type="number"
              value={rackUnit}
            />
          </label>
          <Button disabled={saving || !locationKey} type="submit">
            {saving ? "Đang lưu…" : "Đổi location"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Khi chuyển sang tầng khác, placement 2D cũ sẽ được gỡ để tránh sai
            tọa độ.
          </p>
        </form>
      )}
      {locked ? (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
          Baseline đang khóa: chỉ cho phép chỉnh Hostname và Display name; các
          mutation kỹ thuật vẫn bị vô hiệu hóa.
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
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
        </div>
      )}
      <span aria-live="polite" className="text-sm text-muted-foreground">
        {message}
      </span>
    </div>
  );
}
