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
type LocalPoint = { x: number; y: number };
type SpatialZone = {
  id: string;
  floorMapId: string;
  areaM2: number | null;
  labelX: number | null;
  labelY: number | null;
  geometryJson:
    | { type: "POLYGON"; rings: LocalPoint[][] }
    | {
        type: "RECTANGLE";
        origin: LocalPoint;
        widthMeters: number;
        heightMeters: number;
      };
  zone: { code: string; name: string };
};
type CableRoute = {
  id: string;
  routeType: string;
  calculatedLengthMeters: number | null;
  points: Array<{
    floorId: string;
    xMeters: number;
    yMeters: number;
    zMeters: number;
    riserId: string | null;
  }>;
};
type RackPlacement = {
  id: string;
  rackId: string;
  zoneId: string;
  xMeters: number;
  yMeters: number;
  widthMeters: number;
  depthMeters: number;
  heightMeters: number;
  rotationDegrees: number;
  rack: { code: string; name: string; rackUnits: number };
  zone: { code: string };
};
type Riser = {
  id: string;
  code: string;
  name: string;
  type: string;
  xMeters: number | null;
  yMeters: number | null;
};
type DrawingMode = "PLACE" | "RACK" | "ZONE" | "ROUTE" | "MEASURE";
export interface FloorSpatialData {
  floor: {
    id: string;
    code: string;
    name: string;
    elevationMeters: number | null;
    building: {
      id: string;
      code: string;
      floors: Array<{
        id: string;
        code: string;
        name: string;
        elevationMeters: number | null;
      }>;
    };
    zones: Array<{
      id: string;
      code: string;
      name: string;
      racks: Array<{
        id: string;
        code: string;
        name: string;
        rackUnits: number;
      }>;
    }>;
  };
  maps: MapRecord[];
  placements: Placement[];
  devices: Device[];
  pages: Array<{
    id: string;
    pageNumber: number;
    drawingDocument: { name: string };
  }>;
  spatialZones: SpatialZone[];
  cableRoutes: CableRoute[];
  rackPlacements: RackPlacement[];
  risers: Riser[];
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
  const [drawingMode, setDrawingMode] = useState<DrawingMode>("PLACE");
  const [selectedZoneId, setSelectedZoneId] = useState(
    data.floor.zones[0]?.id ?? "",
  );
  const [selectedRackId, setSelectedRackId] = useState("");
  const [selectedRiserId, setSelectedRiserId] = useState("");
  const [targetFloorId, setTargetFloorId] = useState("");
  const [draftPoints, setDraftPoints] = useState<LocalPoint[]>([]);
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
  ): Promise<boolean> {
    const response = await fetch(url, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = (await response.json()) as {
      errors?: Array<{ message?: string }>;
    };
    if (!response.ok) {
      setMessage(result.errors?.[0]?.message ?? "Operation failed.");
      return false;
    }
    setMessage("Saved.");
    router.refresh();
    return true;
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
  function pointFromEvent(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const pdfX = ((event.clientX - bounds.left) / bounds.width) * width;
    const pdfY = ((event.clientY - bounds.top) / bounds.height) * height;
    return { x: pdfX * scale, y: pdfY * scale };
  }
  async function canvasPointerDown(event: PointerEvent<SVGSVGElement>) {
    if (!map) return;
    if (drawingMode === "RACK") {
      const rack = data.floor.zones
        .flatMap((zone) =>
          zone.racks.map((item) => ({ ...item, zoneId: zone.id })),
        )
        .find((item) => item.id === selectedRackId);
      if (!rack) return;
      const point = pointFromEvent(event);
      if (
        await mutate("/api/rack-placements", "POST", {
          rackId: rack.id,
          zoneId: rack.zoneId,
          scenarioId,
          floorId: data.floor.id,
          floorMapId: map.id,
          xMeters: point.x,
          yMeters: point.y,
        })
      )
        setSelectedRackId("");
      return;
    }
    if (drawingMode !== "PLACE") {
      setDraftPoints((points) => [...points, pointFromEvent(event)]);
      return;
    }
    if (!selectedDevice) return;
    const point = pointFromEvent(event);
    await mutate("/api/device-placements", "POST", {
      deviceInstanceId: selectedDevice,
      scenarioId,
      floorId: data.floor.id,
      floorMapId: map.id,
      xMeters: point.x,
      yMeters: point.y,
    });
    setSelectedDevice("");
  }
  function selectMode(mode: DrawingMode) {
    setDrawingMode(mode);
    setDraftPoints([]);
    setMessage("");
  }
  async function finishZone() {
    if (!map || !selectedZoneId || draftPoints.length < 3) return;
    const ring = [...draftPoints, draftPoints[0]!];
    if (
      await mutate("/api/spatial-zones", "POST", {
        scenarioId,
        zoneId: selectedZoneId,
        floorId: data.floor.id,
        floorMapId: map.id,
        geometry: { type: "POLYGON", rings: [ring] },
      })
    )
      setDraftPoints([]);
  }
  async function finishRoute() {
    if (draftPoints.length < 2) return;
    const riser = data.risers.find((item) => item.id === selectedRiserId);
    const targetFloor = data.floor.building.floors.find(
      (floor) => floor.id === targetFloorId,
    );
    const routePoints = draftPoints.map((point) => ({
      floorId: data.floor.id,
      xMeters: point.x,
      yMeters: point.y,
      zMeters: data.floor.elevationMeters ?? 0,
    }));
    if (riser && targetFloor) {
      const xMeters = riser.xMeters ?? draftPoints.at(-1)!.x;
      const yMeters = riser.yMeters ?? draftPoints.at(-1)!.y;
      routePoints.push({
        floorId: data.floor.id,
        xMeters,
        yMeters,
        zMeters: data.floor.elevationMeters ?? 0,
        riserId: riser.id,
      } as (typeof routePoints)[number]);
      routePoints.push({
        floorId: targetFloor.id,
        xMeters,
        yMeters,
        zMeters: targetFloor.elevationMeters ?? 0,
        riserId: riser.id,
      } as (typeof routePoints)[number]);
    }
    if (
      await mutate("/api/cable-routes", "POST", {
        scenarioId,
        routeType: "FIBER",
        points: routePoints,
      })
    )
      setDraftPoints([]);
  }
  async function createRiser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (
      await mutate("/api/risers", "POST", {
        scenarioId,
        buildingId: data.floor.building.id,
        code: form.get("code"),
        name: form.get("name"),
        type: "DATA",
        xMeters: Number(form.get("xMeters")),
        yMeters: Number(form.get("yMeters")),
      })
    )
      formElement.reset();
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
  const draftLength = draftPoints.slice(1).reduce((total, point, index) => {
    const previous = draftPoints[index]!;
    return total + Math.hypot(point.x - previous.x, point.y - previous.y);
  }, 0);
  const toSvgPoints = (points: LocalPoint[]) =>
    points.map((point) => `${point.x / scale},${point.y / scale}`).join(" ");
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
        <div className="space-y-2">
          <p className="text-sm font-semibold">Editor tool</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {(
              [
                ["PLACE", "Place device"],
                ["RACK", "Place rack"],
                ["ZONE", "Draw zone"],
                ["ROUTE", "Cable route"],
                ["MEASURE", "Measure"],
              ] as Array<[DrawingMode, string]>
            ).map(([mode, label]) => (
              <button
                className={`rounded border p-2 ${drawingMode === mode ? "border-primary bg-primary/10" : ""}`}
                key={mode}
                onClick={() => selectMode(mode)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          {drawingMode === "ZONE" && (
            <select
              className="w-full rounded border bg-background p-2 text-sm"
              onChange={(event) => setSelectedZoneId(event.target.value)}
              value={selectedZoneId}
            >
              <option value="">Choose administrative zone</option>
              {data.floor.zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.code} · {zone.name}
                </option>
              ))}
            </select>
          )}
          {drawingMode === "RACK" && (
            <select
              className="w-full rounded border bg-background p-2 text-sm"
              onChange={(event) => setSelectedRackId(event.target.value)}
              value={selectedRackId}
            >
              <option value="">Choose unplaced rack</option>
              {data.floor.zones.flatMap((zone) =>
                zone.racks
                  .filter(
                    (rack) =>
                      !data.rackPlacements.some(
                        (placement) => placement.rackId === rack.id,
                      ),
                  )
                  .map((rack) => (
                    <option key={rack.id} value={rack.id}>
                      {zone.code} / {rack.code} · {rack.rackUnits}U
                    </option>
                  )),
              )}
            </select>
          )}
          {drawingMode === "ZONE" && (
            <button
              className="w-full rounded bg-primary p-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              disabled={draftPoints.length < 3 || !selectedZoneId}
              onClick={finishZone}
              type="button"
            >
              Close & save zone ({draftPoints.length})
            </button>
          )}
          {drawingMode === "ROUTE" && (
            <div className="space-y-2">
              <select
                className="w-full rounded border bg-background p-2 text-sm"
                onChange={(event) => setSelectedRiserId(event.target.value)}
                value={selectedRiserId}
              >
                <option value="">Single-floor route</option>
                {data.risers.map((riser) => (
                  <option key={riser.id} value={riser.id}>
                    Via {riser.code} · {riser.type}
                  </option>
                ))}
              </select>
              {selectedRiserId && (
                <select
                  className="w-full rounded border bg-background p-2 text-sm"
                  onChange={(event) => setTargetFloorId(event.target.value)}
                  value={targetFloorId}
                >
                  <option value="">Choose target floor</option>
                  {data.floor.building.floors
                    .filter((floor) => floor.id !== data.floor.id)
                    .map((floor) => (
                      <option key={floor.id} value={floor.id}>
                        {floor.code} · {floor.name}
                      </option>
                    ))}
                </select>
              )}
              <button
                className="w-full rounded bg-primary p-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                disabled={
                  draftPoints.length < 2 ||
                  (Boolean(selectedRiserId) && !targetFloorId)
                }
                onClick={finishRoute}
                type="button"
              >
                Save route ({draftLength.toFixed(2)} m)
              </button>
            </div>
          )}
          {drawingMode === "MEASURE" && draftPoints.length > 0 && (
            <p className="rounded border p-2 text-sm">
              Distance: {draftLength.toFixed(2)} m
            </p>
          )}
          {draftPoints.length > 0 && (
            <button
              className="w-full rounded border p-2 text-xs"
              onClick={() => setDraftPoints([])}
              type="button"
            >
              Clear draft
            </button>
          )}
        </div>
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
            onPointerDown={canvasPointerDown}
            viewBox={`0 0 ${width} ${height}`}
          >
            {data.spatialZones
              .filter((zone) => zone.floorMapId === map.id)
              .map((zone) => {
                const geometry = zone.geometryJson;
                if (geometry.type === "RECTANGLE")
                  return (
                    <rect
                      className="fill-sky-500/20 stroke-sky-500"
                      height={geometry.heightMeters / scale}
                      key={zone.id}
                      width={geometry.widthMeters / scale}
                      x={geometry.origin.x / scale}
                      y={geometry.origin.y / scale}
                    />
                  );
                return (
                  <polygon
                    className="fill-sky-500/20 stroke-sky-500"
                    key={zone.id}
                    points={toSvgPoints(geometry.rings[0] ?? [])}
                  />
                );
              })}
            {data.cableRoutes.map((route) => {
              const points = route.points
                .filter((point) => point.floorId === data.floor.id)
                .map((point) => ({ x: point.xMeters, y: point.yMeters }));
              return points.length > 1 ? (
                <polyline
                  className="fill-none stroke-amber-500 stroke-[3]"
                  key={route.id}
                  points={toSvgPoints(points)}
                />
              ) : null;
            })}
            {data.rackPlacements.map((placement) => (
              <g
                key={placement.id}
                transform={`rotate(${placement.rotationDegrees} ${placement.xMeters / scale} ${placement.yMeters / scale})`}
              >
                <rect
                  className="fill-violet-500/40 stroke-violet-300 stroke-[2]"
                  height={placement.depthMeters / scale}
                  width={placement.widthMeters / scale}
                  x={
                    placement.xMeters / scale -
                    placement.widthMeters / scale / 2
                  }
                  y={
                    placement.yMeters / scale -
                    placement.depthMeters / scale / 2
                  }
                />
                <text
                  className="fill-violet-100 text-[9px] font-bold"
                  x={placement.xMeters / scale + 5}
                  y={placement.yMeters / scale}
                >
                  {placement.rack.code}
                </text>
              </g>
            ))}
            {draftPoints.length > 0 && (
              <polyline
                className={`fill-none stroke-[2] [stroke-dasharray:6_4] ${drawingMode === "ZONE" ? "stroke-sky-300" : "stroke-lime-400"}`}
                points={toSvgPoints(
                  drawingMode === "ZONE" && draftPoints.length > 2
                    ? [...draftPoints, draftPoints[0]!]
                    : draftPoints,
                )}
              />
            )}
            {draftPoints.map((point, index) => (
              <circle
                className="fill-background stroke-lime-400"
                cx={point.x / scale}
                cy={point.y / scale}
                key={`${point.x}:${point.y}:${index}`}
                r={4}
              />
            ))}
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
            Spatial layers ({data.spatialZones.length} zones ·{" "}
            {data.cableRoutes.length} routes)
          </h3>
          {data.spatialZones.map((zone) => (
            <div className="rounded border p-2 text-sm" key={zone.id}>
              <span className="font-semibold">{zone.zone.code}</span>
              {zone.areaM2 !== null && ` · ${zone.areaM2.toFixed(2)} m²`}
            </div>
          ))}
          {data.cableRoutes.map((route) => (
            <div className="rounded border p-2 text-sm" key={route.id}>
              <span className="font-semibold">{route.routeType}</span>
              {route.calculatedLengthMeters !== null &&
                ` · ${route.calculatedLengthMeters.toFixed(2)} m`}
              <button
                className="ml-2 text-destructive"
                onClick={() =>
                  mutate(
                    `/api/cable-routes/${route.id}?scenarioId=${scenarioId}`,
                    "DELETE",
                  )
                }
                type="button"
              >
                Delete
              </button>
            </div>
          ))}
          {data.rackPlacements.map((placement) => (
            <div className="rounded border p-2 text-sm" key={placement.id}>
              <span className="font-semibold">{placement.rack.code}</span> ·{" "}
              {placement.rack.rackUnits}U · {placement.zone.code}
              <button
                className="ml-2 text-destructive"
                onClick={() =>
                  mutate(
                    `/api/rack-placements/${placement.id}?scenarioId=${scenarioId}`,
                    "DELETE",
                  )
                }
                type="button"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
        <form className="grid grid-cols-2 gap-2" onSubmit={createRiser}>
          <h3 className="col-span-2 font-semibold">Building riser</h3>
          <input
            className="rounded border bg-background p-2 text-sm"
            name="code"
            placeholder="R-01"
            required
          />
          <input
            className="rounded border bg-background p-2 text-sm"
            name="name"
            placeholder="Data riser"
            required
          />
          <input
            className="rounded border bg-background p-2 text-sm"
            name="xMeters"
            placeholder="X meters"
            required
            step="any"
            type="number"
          />
          <input
            className="rounded border bg-background p-2 text-sm"
            name="yMeters"
            placeholder="Y meters"
            required
            step="any"
            type="number"
          />
          <button className="col-span-2 rounded border p-2 text-sm">
            Add data riser
          </button>
          <p className="col-span-2 text-xs text-muted-foreground">
            Reference drawings place repeated shafts near the stair/elevator
            core; confirm calibrated coordinates before saving.
          </p>
        </form>
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
