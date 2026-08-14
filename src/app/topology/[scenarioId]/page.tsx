import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { TopologyCanvas } from "@/components/topology/topology-canvas";
import type { DeviceNodeData } from "@/components/topology/device-node";
import { AppError } from "@/server/errors";
import {
  getTopology,
  toTopologyLinkDto,
} from "@/server/services/topologyService";
import {
  getInventoryOptions,
  listInventory,
} from "@/server/services/inventoryService";
import { getProjectCostSummary } from "@/server/services/projectCostService";

export const dynamic = "force-dynamic";

export default async function TopologyPage(props: {
  params: Promise<{ scenarioId: string }>;
}) {
  const { scenarioId } = await props.params;
  let topology;
  try {
    topology = await getTopology(scenarioId);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
  if (!topology.scenario) notFound();
  const [options, inventoryDevices, costSummary] = await Promise.all([
    getInventoryOptions(),
    listInventory({}),
    getProjectCostSummary(scenarioId),
  ]);
  const { models } = options;
  const connectedPorts = new Set(
    topology.links.flatMap((link) => [link.sourcePortId, link.targetPortId]),
  );
  const devices = topology.devices.map((device) => ({
    id: device.id,
    graphX: device.graphX,
    graphY: device.graphY,
    unitPriceVnd: device.unitPriceOverrideVnd ?? device.model.unitPriceVnd,
    priceVatRateBps:
      device.priceVatRateOverrideBps ?? device.model.priceVatRateBps,
    data: {
      hostname: device.hostname,
      model: `${device.model.vendor.name} ${device.model.modelName}`,
      category: device.model.category,
      location: `${device.building.code} / ${device.floor.code}`,
      floorId: device.floor.id,
      floorCode: device.floor.code,
      floorName: device.floor.name,
      floorLevel: device.floor.level,
      buildingId: device.building.id,
      ports: device.ports.map((port) => ({
        id: port.id,
        name: port.name,
        media: port.media,
        poeStandard: port.poeStandard,
        supportedSpeedsMbps: port.supportedSpeedsMbps,
        connected: connectedPorts.has(port.id),
      })),
    } satisfies DeviceNodeData,
  }));

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            Floor-first network design ·{" "}
            {topology.scenario.isLocked ? "Read only" : "Editable"}
          </p>
          <h1 className="mt-2 text-3xl font-bold">{topology.scenario.name}</h1>
          <p className="mt-2 text-muted-foreground">
            Giữ B2 Server Room làm điểm hội tụ và hoàn thiện kết nối theo từng
            tầng.
            <span className="ml-2">
              {devices.length} thiết bị · {topology.links.length} kết nối
            </span>
          </p>
        </div>
        <TopologyCanvas
          devices={devices}
          links={topology.links.map(toTopologyLinkDto)}
          scenario={topology.scenario}
          models={models}
          availableFloors={options.buildings.flatMap((building) =>
            building.floors.map((floor) => ({
              id: floor.id,
              code: floor.code,
              name: floor.name,
              level: floor.level,
              buildingId: building.id,
            })),
          )}
          availableInventoryDevices={inventoryDevices
            .filter((device) => device.scenarioId !== scenarioId)
            .map((device) => ({
              id: device.id,
              scenarioName: device.scenario.name,
              hostname: device.hostname,
              displayName: device.displayName,
              modelId: device.modelId,
              modelName: `${device.model.vendor.name} ${device.model.modelName}`,
              buildingId: device.buildingId,
              floorId: device.floorId,
              floorCode: device.floor.code,
            }))}
          fixedCostVnd={costSummary.lines
            .filter((line) => line.kind === "FIXED")
            .reduce((sum, line) => sum + line.totalVnd, 0)}
        />
      </div>
    </AppShell>
  );
}
