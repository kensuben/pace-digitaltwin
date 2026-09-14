"use client";

import {
  Box,
  CheckCircle2,
  Cpu,
  GripVertical,
  RotateCcw,
  Server,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DeviceDetailsPanel } from "./device-details-panel";
import { RackTransfer } from "./rack-transfer";

import {
  VirtualMachineManager,
  type VirtualMachineDto,
} from "@/components/racks/virtual-machine-manager";

type RackDevice = {
  id: string;
  hostname: string;
  displayName: string;
  category: string;
  sku: string;
  modelName: string;
  vendorName: string;
  rackUnits: number;
  rackId: string | null;
  rackUnitStart: number | null;
  virtualMachines: VirtualMachineDto[];
};
type RackDto = {
  id: string;
  code: string;
  name: string;
  rackUnits: number;
  devices: RackDevice[];
};

export function RackDesigner({
  scenarioId,
  isLocked,
  racks: initialRacks,
  unplacedDevices: initialUnplaced,
}: {
  scenarioId: string;
  isLocked: boolean;
  racks: RackDto[];
  unplacedDevices: RackDevice[];
}) {
  const router = useRouter();
  const [racks, setRacks] = useState(initialRacks);
  const [unplaced, setUnplaced] = useState(initialUnplaced);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleRackId, setVisibleRackId] = useState("all");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);
  const [vmServerId, setVmServerId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const allDevices = useMemo(
    () => [...unplaced, ...racks.flatMap((rack) => rack.devices)],
    [racks, unplaced],
  );
  const selected =
    allDevices.find((device) => device.id === selectedId) ?? null;
  const vmServer =
    allDevices.find((device) => device.id === vmServerId) ?? null;

  function updateVirtualMachines(
    deviceId: string,
    virtualMachines: VirtualMachineDto[],
  ) {
    setUnplaced((items) =>
      items.map((device) =>
        device.id === deviceId ? { ...device, virtualMachines } : device,
      ),
    );
    setRacks((items) =>
      items.map((rack) => ({
        ...rack,
        devices: rack.devices.map((device) =>
          device.id === deviceId ? { ...device, virtualMachines } : device,
        ),
      })),
    );
  }

  async function persist(
    device: RackDevice,
    rack: RackDto | null,
    rackUnitStart?: number,
  ) {
    if (isLocked || isPending || saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/rack-design/${scenarioId}/devices/${device.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            rack
              ? { action: "place", rackId: rack.id, rackUnitStart }
              : { action: "remove" },
          ),
        },
      );
      const payload = (await response.json()) as {
        errors?: Array<{ message: string }>;
      };
      if (!response.ok) {
        setNotice({
          kind: "error",
          text: payload.errors?.[0]?.message ?? "Không thể lưu vị trí rack.",
        });
        return;
      }
      const moved = {
        ...device,
        rackId: rack?.id ?? null,
        rackUnitStart: rackUnitStart ?? null,
      };
      setUnplaced((items) =>
        rack
          ? items.filter((item) => item.id !== device.id)
          : [...items.filter((item) => item.id !== device.id), moved].sort(
              byHostname,
            ),
      );
      setRacks((items) =>
        items.map((item) => ({
          ...item,
          devices:
            item.id === rack?.id
              ? [
                  ...item.devices.filter((entry) => entry.id !== device.id),
                  moved,
                ].sort(byRackPosition)
              : item.devices.filter((entry) => entry.id !== device.id),
        })),
      );
      setSelectedId(null);
      setNotice({
        kind: "ok",
        text: rack
          ? `${device.hostname} đã được lắp tại ${rack.code} · U${rackUnitStart}.`
          : `${device.hostname} đã được đưa ra khỏi rack.`,
      });
      startTransition(() => router.refresh());
    } catch {
      setNotice({
        kind: "error",
        text: "Không thể kết nối để lưu vị trí rack. Vui lòng thử lại.",
      });
    } finally {
      setSaving(false);
    }
  }

  function placeAt(rack: RackDto, unit: number, device = selected) {
    if (device) void persist(device, rack, unit);
  }

  const installedUnits = racks.reduce(
    (sum, rack) =>
      sum + rack.devices.reduce((used, device) => used + device.rackUnits, 0),
    0,
  );
  const totalUnits = racks.reduce((sum, rack) => sum + rack.rackUnits, 0);
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Rack trong B2" value={racks.length} />
        <Metric
          label="Đã sử dụng"
          value={`${installedUnits} / ${totalUnits}U`}
        />
        <Metric label="Chờ lắp" value={unplaced.length} />
      </div>
      {notice && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${notice.kind === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-destructive/30 bg-destructive/10 text-destructive"}`}
        >
          {notice.kind === "ok" ? (
            <CheckCircle2 size={17} />
          ) : (
            <TriangleAlert size={17} />
          )}{" "}
          {notice.text}
        </div>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(220px,0.65fr)_minmax(320px,1fr)_minmax(300px,0.9fr)]">
        <aside className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm xl:sticky xl:top-28">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Thiết bị B2
            </p>
            <h2 className="mt-1 text-xl font-bold">Chờ lắp lên rack</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Kéo thiết bị vào một U trống, hoặc chọn thiết bị rồi nhấn vào U
              đích.
            </p>
          </div>
          <div className="space-y-2">
            {unplaced.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                selected={selectedId === device.id}
                disabled={isLocked}
                onSelect={() =>
                  setSelectedId(selectedId === device.id ? null : device.id)
                }
              />
            ))}
            {unplaced.length === 0 && (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Tất cả thiết bị B2 đã được bố trí.
              </div>
            )}
          </div>
          {isLocked && (
            <p className="rounded-lg bg-amber-500/10 p-3 text-sm font-medium text-amber-700">
              Scenario đang khóa. Rack chỉ có thể xem.
            </p>
          )}
          {selected && !isLocked && (
            <RackTransfer
              key={selected.id}
              device={selected}
              racks={racks}
              disabled={saving || isPending}
              onPlace={(rackId, unit) => {
                const rack = racks.find((item) => item.id === rackId);
                if (rack) {
                  setVisibleRackId(rackId);
                  placeAt(rack, unit);
                }
              }}
            />
          )}
        </aside>
        <section className="grid min-w-0 gap-6">
          {racks.length > 1 && (
            <label className="grid gap-2 rounded-xl border bg-card p-3 text-sm font-bold">
              Tủ rack đang xem
              <select
                className="min-w-0 rounded-lg border bg-background p-2"
                value={visibleRackId}
                onChange={(event) => setVisibleRackId(event.target.value)}
              >
                <option value="all">Tất cả {racks.length} tủ rack</option>
                {racks.map((rack) => (
                  <option key={rack.id} value={rack.id}>
                    {rack.code} · {rack.name} ·{" "}
                    {rack.devices.reduce(
                      (sum, device) => sum + device.rackUnits,
                      0,
                    )}
                    /{rack.rackUnits}U
                  </option>
                ))}
              </select>
            </label>
          )}
          {racks
            .filter(
              (rack) => visibleRackId === "all" || rack.id === visibleRackId,
            )
            .map((rack) => (
              <RackCabinet
                key={rack.id}
                rack={rack}
                selected={selected}
                disabled={isLocked || isPending || saving}
                onManageVms={setVmServerId}
                onPlace={placeAt}
                onSelect={setSelectedId}
                onRemove={(device) => void persist(device, null)}
              />
            ))}
          {racks.length === 0 && (
            <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
              Chưa có rack nào được khai báo trong Server Room B2.
            </div>
          )}
        </section>
        <div
          className={
            selected
              ? "fixed inset-x-3 bottom-3 z-30 max-h-[65dvh] overflow-y-auto rounded-2xl shadow-2xl xl:sticky xl:inset-auto xl:top-28 xl:z-auto xl:max-h-none xl:min-w-0 xl:overflow-visible xl:shadow-none"
              : "min-w-0"
          }
        >
          {selected ? (
            <DeviceDetailsPanel
              key={`${scenarioId}:${selected.id}`}
              deviceId={selected.id}
              scenarioId={scenarioId}
              rackLabel={
                selected.rackId
                  ? `${racks.find((rack) => rack.id === selected.rackId)?.code ?? "Rack"} · U${selected.rackUnitStart}`
                  : "Chờ lắp lên rack"
              }
              virtualMachines={selected.virtualMachines}
              onClose={() => setSelectedId(null)}
              onManageVms={() => setVmServerId(selected.id)}
            />
          ) : (
            <aside className="rounded-2xl border border-dashed bg-card p-5 text-sm text-muted-foreground">
              <h2 className="mb-2 font-bold text-foreground">
                Thông tin thiết bị
              </h2>
              Chọn một thiết bị trên rack hoặc trong danh sách chờ để xem thông
              tin và cấu hình.
            </aside>
          )}
        </div>
      </div>
      {vmServer?.category === "SERVER" && (
        <VirtualMachineManager
          isLocked={isLocked}
          onChanged={(machines) => updateVirtualMachines(vmServer.id, machines)}
          onClose={() => setVmServerId(null)}
          scenarioId={scenarioId}
          server={vmServer}
        />
      )}
    </div>
  );
}

function RackCabinet({
  rack,
  selected,
  disabled,
  onManageVms,
  onPlace,
  onSelect,
  onRemove,
}: {
  rack: RackDto;
  selected: RackDevice | null;
  disabled: boolean;
  onPlace: (rack: RackDto, unit: number, device?: RackDevice | null) => void;
  onManageVms: (id: string) => void;
  onSelect: (id: string | null) => void;
  onRemove: (device: RackDevice) => void;
}) {
  const unitHeight = 30;
  const occupied = new Set(
    rack.devices.flatMap((device) =>
      Array.from(
        { length: device.rackUnits },
        (_, index) => (device.rackUnitStart ?? 0) + index,
      ),
    ),
  );
  return (
    <div className="overflow-hidden rounded-2xl border-4 border-slate-700 bg-slate-950 shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-700 bg-slate-900 px-4 py-3 text-white">
        <div>
          <p className="font-mono text-xs text-cyan-400">SERVER ROOM B2</p>
          <h3 className="font-bold">{rack.code}</h3>
          <p className="text-xs text-slate-400">{rack.name}</p>
        </div>
        <div className="rounded-lg border border-slate-600 px-2 py-1 font-mono text-sm">
          {rack.rackUnits}U
        </div>
      </div>
      <div
        className="relative bg-slate-900/80"
        style={{ height: rack.rackUnits * unitHeight }}
      >
        {Array.from(
          { length: rack.rackUnits },
          (_, index) => rack.rackUnits - index,
        ).map((unit) => (
          <button
            aria-label={`Đặt thiết bị tại U${unit}`}
            className={`absolute left-0 right-0 flex items-center border-b border-slate-700/80 text-left transition ${selected && !occupied.has(unit) ? "cursor-pointer hover:bg-cyan-400/15" : "cursor-default"}`}
            disabled={disabled || !selected || occupied.has(unit)}
            key={unit}
            onClick={() => onPlace(rack, unit)}
            onDragOver={(event) => {
              if (!disabled && !occupied.has(unit)) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              const raw = event.dataTransfer.getData(
                "application/x-rack-device",
              );
              if (raw) onPlace(rack, unit, JSON.parse(raw) as RackDevice);
            }}
            style={{
              height: unitHeight,
              top: (rack.rackUnits - unit) * unitHeight,
            }}
            type="button"
          >
            <span className="w-11 shrink-0 pl-2 font-mono text-[10px] text-slate-500">
              U{unit}
            </span>
            <span className="h-px flex-1 bg-slate-700/50" />
          </button>
        ))}
        {rack.devices.map((device) => {
          if (!device.rackUnitStart) return null;
          const top =
            (rack.rackUnits - (device.rackUnitStart + device.rackUnits - 1)) *
            unitHeight;
          return (
            <div
              className={`absolute left-11 right-2 z-10 flex items-center gap-2 overflow-hidden rounded border px-2 text-white shadow-lg ${selected?.id === device.id ? "ring-2 ring-cyan-300 border-cyan-200" : ""} ${device.category === "SERVER" ? "border-violet-300/60 bg-gradient-to-r from-violet-950 to-slate-800" : "border-cyan-300/50 bg-gradient-to-r from-cyan-950 to-slate-800"}`}
              draggable={!disabled}
              key={device.id}
              onClick={() => onSelect(device.id)}
              onDragStart={(event) =>
                event.dataTransfer.setData(
                  "application/x-rack-device",
                  JSON.stringify(device),
                )
              }
              style={{
                height: device.rackUnits * unitHeight - 2,
                top: top + 1,
              }}
            >
              <GripVertical
                className={`shrink-0 ${device.category === "SERVER" ? "text-violet-300" : "text-cyan-400"}`}
                size={14}
              />
              <button
                type="button"
                aria-label={`Xem thông tin ${device.hostname}`}
                aria-pressed={selected?.id === device.id}
                className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-cyan-300"
              >
                <p className="truncate font-mono text-xs font-bold text-cyan-100">
                  {device.hostname}
                </p>
                <p className="truncate text-[10px] text-slate-400">
                  {device.sku} · {device.rackUnits}U
                </p>
              </button>
              {device.category === "SERVER" && (
                <button
                  aria-label={`Quản lý Virtual Machines của ${device.hostname}`}
                  className="flex shrink-0 items-center gap-1 rounded bg-violet-400/15 px-1.5 py-1 text-[9px] font-bold text-violet-200 hover:bg-violet-400/25"
                  onClick={(event) => {
                    event.stopPropagation();
                    onManageVms(device.id);
                  }}
                  title="Quản lý Virtual Machines"
                  type="button"
                >
                  <Cpu size={11} />
                  {device.virtualMachines.length} VM
                </button>
              )}
              {!disabled && (
                <button
                  aria-label={`Đưa ${device.hostname} ra khỏi rack`}
                  className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemove(device);
                  }}
                  title="Đưa ra khỏi rack"
                  type="button"
                >
                  <RotateCcw size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between bg-slate-900 px-4 py-2 text-[11px] text-slate-400">
        <span>Front elevation</span>
        <span>{rack.devices.length} thiết bị</span>
      </div>
    </div>
  );
}

function DeviceCard({
  device,
  selected,
  disabled,
  onSelect,
}: {
  device: RackDevice;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${selected ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "bg-background hover:border-primary/50"}`}
      aria-pressed={selected}
      draggable={!disabled}
      onClick={onSelect}
      onDragStart={(event) =>
        event.dataTransfer.setData(
          "application/x-rack-device",
          JSON.stringify(device),
        )
      }
      type="button"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-900 text-cyan-300">
        <Server size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-sm font-bold">
          {device.hostname}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {device.vendorName} · {device.sku}
        </span>
      </span>
      <span className="rounded-md bg-secondary px-2 py-1 font-mono text-xs font-bold">
        {device.rackUnits}U
      </span>
    </button>
  );
}
function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Box size={15} />
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
const byHostname = (left: RackDevice, right: RackDevice) =>
  left.hostname.localeCompare(right.hostname);
const byRackPosition = (left: RackDevice, right: RackDevice) =>
  (right.rackUnitStart ?? 0) - (left.rackUnitStart ?? 0);
