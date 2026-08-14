import { AppShell } from "@/components/app-shell";
import {
  FloorMapEditor,
  type FloorSpatialData,
} from "@/components/spatial/floor-map-editor";
import { getFloorSpatial } from "@/server/services/floorMapService";
export const dynamic = "force-dynamic";
export default async function FloorMapPage({
  params,
  searchParams,
}: {
  params: Promise<{ floorId: string }>;
  searchParams: Promise<{ scenarioId?: string }>;
}) {
  const { floorId } = await params;
  const { scenarioId = "scenario-proposed" } = await searchParams;
  const data = (await getFloorSpatial(floorId, scenarioId)) as FloorSpatialData;
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            SP-3 · Spatial planning
          </p>
          <h1 className="mt-2 text-4xl font-bold">
            {data.floor.building.code} / {data.floor.code}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Draw zones, measure distances, route cables và place thiết bị bằng
            canonical floor coordinates (meters).
          </p>
        </div>
        <FloorMapEditor data={data} scenarioId={scenarioId} />
      </div>
    </AppShell>
  );
}
