"use client";

import { FormEvent, PointerEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

type MapRecord = {
  id: string;
  name: string;
  opacity: number;
  isActive: boolean;
  drawingPageId: string | null;
  drawingPage: {
    widthPoints: number | null;
    heightPoints: number | null;
  } | null;
  calibration: { calculatedMetersPerPdfPoint: number } | null;
};
type Device = {
  id: string;
  hostname: string;
  model: { category: string };
  placement: { id: string } | null;
};
type Placement = {
  id: string;
  deviceInstanceId: string;
  xMeters: number;
  yMeters: number;
  rotationZ: number;
  device: { hostname: string; model: { category: string } };
};
export interface FloorSpatialData {
  floor: { id: string; code: string; name: string; building: { code: string } };
  maps: MapRecord[];
  placements: Placement[];
  devices: Device[];
  pages: Array<{
    id: string;
    pageNumber: number;
    drawingDocument: { name: string };
  }>;
}

export function FloorMapEditor({
  data,
  scenarioId,
}: {
  data: FloorSpatialData;
  scenarioId: string;
}) {
  const router = useRouter();
  const [mapId, setMapId] = useState(
    data.maps.find((map) => map.isActive)?.id ?? data.maps[0]?.id ?? "",
  );
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedDevice, setSelectedDevice] = useState("");
  const [message, setMessage] = useState("");
  const map = data.maps.find((item) => item.id === mapId);
  const scale = map?.calibration?.calculatedMetersPerPdfPoint ?? 1;
  const width = map?.drawingPage?.widthPoints ?? 800;
  const height = map?.drawingPage?.heightPoints ?? 600;
  const unplaced = data.devices.filter((device) => !device.placement);
  async function mutate(
    url: string,
    method: "POST" | "PATCH" | "DELETE",
    body?: object,
  ) {
    const response = await fetch(url, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = (await response.json()) as { error?: { message?: string } };
    if (!response.ok) {
      setMessage(result.error?.message ?? "Operation failed.");
      return;
    }
    setMessage("Saved.");
    router.refresh();
  }
  async function calibrate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!map) return;
    const form = new FormData(event.currentTarget);
    await mutate(`/api/floor-maps/${map.id}/calibrate`, "POST", {
      scenarioId,
      pointA: { x: Number(form.get("ax")), y: Number(form.get("ay")) },
      pointB: { x: Number(form.get("bx")), y: Number(form.get("by")) },
      realDistanceMeters: Number(form.get("distance")),
      createdBy: "local-admin",
    });
  }
  async function createMap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate(`/api/floors/${data.floor.id}/maps`, "POST", {
      scenarioId,
      drawingPageId: form.get("drawingPageId"),
      name: form.get("name"),
      opacity: 1,
    });
  }
  async function place(event: PointerEvent<SVGSVGElement>) {
    if (!selectedDevice || !map) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const pdfX = ((event.clientX - bounds.left) / bounds.width) * width;
    const pdfY = ((event.clientY - bounds.top) / bounds.height) * height;
    await mutate("/api/device-placements", "POST", {
      deviceInstanceId: selectedDevice,
      scenarioId,
      floorId: data.floor.id,
      floorMapId: map.id,
      xMeters: pdfX * scale,
      yMeters: pdfY * scale,
    });
    setSelectedDevice("");
  }
  async function move(
    placement: Placement,
    event: PointerEvent<SVGCircleElement>,
  ) {
    event.stopPropagation();
    if (!map) return;
    const svg = event.currentTarget.ownerSVGElement!;
    const bounds = svg.getBoundingClientRect();
    const pdfX = ((event.clientX - bounds.left) / bounds.width) * width;
    const pdfY = ((event.clientY - bounds.top) / bounds.height) * height;
    await mutate(
      `/api/device-placements/${placement.id}?scenarioId=${scenarioId}`,
      "PATCH",
      {
        deviceInstanceId: placement.deviceInstanceId,
        floorId: data.floor.id,
        floorMapId: map.id,
        xMeters: pdfX * scale,
        yMeters: pdfY * scale,
        rotationZ: placement.rotationZ,
      },
    );
  }
  async function rotate(placement: Placement) {
    if (!map) return;
    await mutate(
      `/api/device-placements/${placement.id}?scenarioId=${scenarioId}`,
      "PATCH",
      {
        deviceInstanceId: placement.deviceInstanceId,
        floorId: data.floor.id,
        floorMapId: map.id,
        xMeters: placement.xMeters,
        yMeters: placement.yMeters,
        rotationZ: (placement.rotationZ + 45) % 360,
      },
    );
  }
  const markers = data.placements.map((placement) => ({
    ...placement,
    x: placement.xMeters / scale,
    y: placement.yMeters / scale,
  }));
  if (!map)
    return (
      <form
        className="grid gap-3 rounded-xl border bg-card p-6 md:grid-cols-3"
        onSubmit={createMap}
      >
        <input
          className="rounded border bg-background p-2"
          name="name"
          placeholder="Floor map name"
          required
        />
        <select
          className="rounded border bg-background p-2"
          name="drawingPageId"
          required
        >
          <option value="">Choose mapped PDF page</option>
          {data.pages.map((page) => (
            <option key={page.id} value={page.id}>
              {page.drawingDocument.name} · page {page.pageNumber}
            </option>
          ))}
        </select>
        <button className="rounded bg-primary p-2 font-semibold text-primary-foreground">
          Create floor map
        </button>
        {message && <p className="md:col-span-3">{message}</p>}
      </form>
    );

  return (
    <div className="grid gap-5 xl:grid-cols-[250px_1fr_280px]">
      <aside className="space-y-4 rounded-xl border bg-card p-4">
        <h2 className="font-bold">Layers & inventory</h2>
        <label className="block text-sm">
          Floor map
          <select
            className="mt-1 w-full rounded border bg-background p-2"
            value={mapId}
            onChange={(event) => setMapId(event.target.value)}
          >
            {data.maps.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-3 gap-1 text-sm">
          <span />
          <button
            className="rounded border p-1"
            onClick={() => setPan((value) => ({ ...value, y: value.y - 40 }))}
          >
            ↑
          </button>
          <span />
          <button
            className="rounded border p-1"
            onClick={() => setPan((value) => ({ ...value, x: value.x - 40 }))}
          >
            ←
          </button>
          <button
            className="rounded border p-1"
            onClick={() => setPan({ x: 0, y: 0 })}
          >
            Reset
          </button>
          <button
            className="rounded border p-1"
            onClick={() => setPan((value) => ({ ...value, x: value.x + 40 }))}
          >
            →
          </button>
          <span />
          <button
            className="rounded border p-1"
            onClick={() => setPan((value) => ({ ...value, y: value.y + 40 }))}
          >
            ↓
          </button>
        </div>
        <div className="space-y-2 text-sm">
          <button
            className="w-full rounded border p-2"
            onClick={() =>
              mutate(`/api/floor-maps/${map.id}`, "PATCH", {
                scenarioId,
                isActive: true,
              })
            }
          >
            Activate map
          </button>
          <button
            className="w-full rounded border p-2"
            onClick={() =>
              mutate(`/api/floor-maps/${map.id}`, "PATCH", {
                scenarioId,
                opacity: map.opacity === 1 ? 0.5 : 1,
              })
            }
          >
            Opacity {map.opacity === 1 ? "50%" : "100%"}
          </button>
          <button
            className="w-full rounded border border-destructive p-2 text-destructive"
            onClick={() =>
              mutate(
                `/api/floor-maps/${map.id}?scenarioId=${scenarioId}`,
                "DELETE",
              )
            }
          >
            Delete map
          </button>
        </div>
        <label className="block text-sm">
          Zoom {zoom.toFixed(1)}×
          <input
            className="w-full"
            max="3"
            min="0.5"
            onChange={(event) => setZoom(Number(event.target.value))}
            step="0.1"
            type="range"
            value={zoom}
          />
        </label>
        <div>
          <p className="mb-2 text-sm font-semibold">Unplaced inventory</p>
          {unplaced.map((device) => (
            <button
              className={`mb-2 w-full rounded border p-2 text-left text-sm ${selectedDevice === device.id ? "border-primary" : ""}`}
              key={device.id}
              onClick={() => setSelectedDevice(device.id)}
            >
              {device.hostname}
              <span className="block text-xs text-muted-foreground">
                {device.model.category}
              </span>
            </button>
          ))}
        </div>
      </aside>
      <main className="overflow-auto rounded-xl border bg-black/30 p-4">
        <div
          className="relative mx-auto origin-top-left"
          style={{
            width,
            height,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            marginBottom: height * (zoom - 1),
          }}
        >
          <Image
            alt="Floor plan"
            className="absolute inset-0 h-full w-full object-contain"
            height={height}
            src={
              map?.drawingPageId
                ? `/api/drawing-pages/${map.drawingPageId}/asset?variant=preview`
                : ""
            }
            style={{ opacity: map?.opacity ?? 1 }}
            unoptimized
            width={width}
          />
          <svg
            className="absolute inset-0 h-full w-full cursor-crosshair"
            onPointerDown={place}
            viewBox={`0 0 ${width} ${height}`}
          >
            {markers.map((marker) => (
              <g key={marker.id}>
                <circle
                  className="cursor-move fill-primary stroke-background"
                  cx={marker.x}
                  cy={marker.y}
                  onPointerDown={(event) => move(marker, event)}
                  r={8}
                />
                <text
                  className="fill-foreground text-[10px]"
                  x={marker.x + 10}
                  y={marker.y + 4}
                >
                  {marker.device.hostname}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </main>
      <aside className="space-y-4 rounded-xl border bg-card p-4">
        <h2 className="font-bold">Calibration</h2>
        <p className="text-xs text-muted-foreground">
          Nhập hai điểm PDF và khoảng cách thực. Placement luôn lưu bằng mét.
        </p>
        <form className="grid grid-cols-2 gap-2" onSubmit={calibrate}>
          {["ax", "ay", "bx", "by"].map((name) => (
            <input
              className="rounded border bg-background p-2"
              key={name}
              name={name}
              placeholder={name.toUpperCase()}
              required
              type="number"
            />
          ))}
          <input
            className="col-span-2 rounded border bg-background p-2"
            name="distance"
            placeholder="Distance meters"
            required
            step="any"
            type="number"
          />
          <button
            className="col-span-2 rounded bg-primary p-2 font-semibold text-primary-foreground"
            disabled={!map}
          >
            Calibrate
          </button>
        </form>
        <p className="text-sm">
          Scale:{" "}
          {map?.calibration
            ? `${map.calibration.calculatedMetersPerPdfPoint.toFixed(5)} m/pt`
            : "Uncalibrated"}
        </p>
        {message && <p className="rounded border p-2 text-sm">{message}</p>}
        <div className="space-y-2">
          <h3 className="font-semibold">
            Placements ({data.placements.length})
          </h3>
          {data.placements.map((placement) => (
            <div className="rounded border p-2 text-sm" key={placement.id}>
              <a
                className="font-bold text-primary hover:underline"
                href={`/inventory/${placement.deviceInstanceId}?scenarioId=${scenarioId}`}
              >
                {placement.device.hostname}
              </a>
              <br />
              {placement.xMeters.toFixed(2)}, {placement.yMeters.toFixed(2)} m{" "}
              <button className="ml-2" onClick={() => rotate(placement)}>
                Rotate
              </button>
              <button
                className="ml-2 text-destructive"
                onClick={() =>
                  mutate(
                    `/api/device-placements/${placement.id}?scenarioId=${scenarioId}`,
                    "DELETE",
                  )
                }
              >
                Delete
              </button>
            </div>
          ))}
        </div>
        <a
          className="block font-semibold text-primary hover:underline"
          href={`/topology/${scenarioId}`}
        >
          Open network topology →
        </a>
      </aside>
    </div>
  );
}
