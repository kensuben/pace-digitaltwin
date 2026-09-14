"use client";

import { useState } from "react";

type Device = {
  id: string;
  hostname: string;
  rackUnits: number;
  rackUnitStart: number | null;
};
type Rack = {
  id: string;
  code: string;
  name: string;
  rackUnits: number;
  devices: Device[];
};

export function availableRackUnits(rack: Rack, device: Device) {
  return Array.from({ length: rack.rackUnits }, (_, i) => i + 1).filter(
    (start) => {
      const end = start + device.rackUnits - 1;
      return (
        end <= rack.rackUnits &&
        !rack.devices.some(
          (other) =>
            other.id !== device.id &&
            other.rackUnitStart !== null &&
            start <= other.rackUnitStart + other.rackUnits - 1 &&
            end >= other.rackUnitStart,
        )
      );
    },
  );
}

export function RackTransfer({
  device,
  racks,
  disabled,
  onPlace,
}: {
  device: Device;
  racks: Rack[];
  disabled: boolean;
  onPlace: (rackId: string, unit: number) => void;
}) {
  const [targetId, setTargetId] = useState(racks[0]?.id ?? "");
  const [unit, setUnit] = useState("");
  const target = racks.find((rack) => rack.id === targetId);
  const units = target ? availableRackUnits(target, device) : [];
  const chosen = units.includes(Number(unit)) ? Number(unit) : units[0];
  return (
    <fieldset
      disabled={disabled}
      className="space-y-3 rounded-xl border bg-background p-3 text-sm"
    >
      <legend className="px-1 font-bold">Bố trí / chuyển tủ rack</legend>
      <p className="break-words text-muted-foreground">
        {device.hostname} · {device.rackUnits}U
      </p>
      <label className="grid gap-1">
        Tủ rack đích
        <select
          className="min-w-0 rounded-lg border bg-card p-2"
          value={targetId}
          onChange={(event) => {
            setTargetId(event.target.value);
            setUnit("");
          }}
        >
          {racks.map((rack) => (
            <option key={rack.id} value={rack.id}>
              {rack.code} · {rack.name} ({rack.rackUnits}U)
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        Vị trí U bắt đầu
        <select
          className="rounded-lg border bg-card p-2"
          value={chosen ?? ""}
          onChange={(event) => setUnit(event.target.value)}
        >
          {units.length ? (
            units.map((start) => (
              <option key={start} value={start}>
                U{start}–U{start + device.rackUnits - 1}
              </option>
            ))
          ) : (
            <option value="">Không đủ U trống liên tiếp</option>
          )}
        </select>
      </label>
      <button
        className="w-full rounded-lg bg-primary px-3 py-2 font-bold text-primary-foreground disabled:opacity-50"
        disabled={disabled || !target || chosen === undefined}
        type="button"
        onClick={() => {
          if (target && chosen !== undefined) onPlace(target.id, chosen);
        }}
      >
        Lưu vị trí rack
      </button>
    </fieldset>
  );
}
