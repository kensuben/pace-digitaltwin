import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { TopologyCanvas } from "@/components/topology/topology-canvas";
import type { DeviceNodeData } from "@/components/topology/device-node";
import { AppError } from "@/server/errors";
import {
  getTopology,
  toTopologyLinkDto,
} from "@/server/services/topologyService";

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
  const connectedPorts = new Set(
    topology.links.flatMap((link) => [link.sourcePortId, link.targetPortId]),
  );
  const devices = topology.devices.map((device, index) => ({
    id: device.id,
    graphX: device.graphX || (index % 3) * 340,
    graphY: device.graphY || Math.floor(index / 3) * 310,
    data: {
      hostname: device.hostname,
      model: `${device.model.vendor.name} ${device.model.modelName}`,
      category: device.model.category,
      location: `${device.building.code} / ${device.floor.code}`,
      ports: device.ports.map((port) => ({
        id: port.id,
        name: port.name,
        media: port.media,
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
            M2 · {topology.scenario.isLocked ? "Read only" : "Editable"}
          </p>
          <h1 className="mt-2 text-3xl font-bold">{topology.scenario.name}</h1>
          <p className="mt-2 text-muted-foreground">
            {devices.length} devices · {topology.links.length} physical links
          </p>
        </div>
        <TopologyCanvas
          devices={devices}
          links={topology.links.map(toTopologyLinkDto)}
          scenario={topology.scenario}
        />
      </div>
    </AppShell>
  );
}
