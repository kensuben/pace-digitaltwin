"use client";

import {
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import { Save, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  DeviceNode,
  type DeviceNodeData,
} from "@/components/topology/device-node";
import { Button } from "@/components/ui/button";

interface TopologyLink extends Record<string, unknown> {
  id: string;
  sourcePortId: string;
  targetPortId: string;
  sourceDeviceId: string;
  targetDeviceId: string;
  linkType: "ETHERNET" | "FIBER" | "DAC" | "AOC";
  speedMbps: number;
  duplex: "FULL" | "HALF" | "AUTO";
  status: "PLANNED" | "ACTIVE" | "INACTIVE" | "INVALID";
  cableLabel: string | null;
  lengthMeters: number | null;
}

interface TopologyCanvasProps {
  scenario: { id: string; name: string; isLocked: boolean };
  devices: Array<{
    id: string;
    graphX: number;
    graphY: number;
    data: DeviceNodeData;
  }>;
  links: TopologyLink[];
}

function edgeFromLink(link: TopologyLink): Edge {
  return {
    id: link.id,
    source: link.sourceDeviceId,
    target: link.targetDeviceId,
    sourceHandle: link.sourcePortId,
    targetHandle: link.targetPortId,
    label: `${link.speedMbps >= 1000 ? `${link.speedMbps / 1000}G` : `${link.speedMbps}M`} · ${link.status}`,
    data: link,
    animated: link.status === "ACTIVE",
    style: { stroke: link.status === "INVALID" ? "#fb7185" : "#2dd4bf" },
  };
}

async function api<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  const payload = (await response.json()) as {
    data: T;
    errors: Array<{ message: string }>;
  };
  if (!response.ok)
    throw new Error(payload.errors[0]?.message ?? "Request failed.");
  return payload.data;
}

export function TopologyCanvas({
  scenario,
  devices,
  links,
}: TopologyCanvasProps) {
  const initialNodes = useMemo<Node<DeviceNodeData>[]>(
    () =>
      devices.map((device) => ({
        id: device.id,
        type: "device",
        position: { x: device.graphX, y: device.graphY },
        data: device.data,
      })),
    [devices],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    links.map(edgeFromLink),
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const nodeTypes = useMemo(() => ({ device: DeviceNode }), []);

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (
        scenario.isLocked ||
        !connection.sourceHandle ||
        !connection.targetHandle
      )
        return;
      const sourceNode = nodes.find((node) => node.id === connection.source);
      const targetNode = nodes.find((node) => node.id === connection.target);
      const sourcePort = sourceNode?.data.ports.find(
        (port) => port.id === connection.sourceHandle,
      );
      const targetPort = targetNode?.data.ports.find(
        (port) => port.id === connection.targetHandle,
      );
      const speeds = sourcePort?.supportedSpeedsMbps.filter((speed) =>
        targetPort?.supportedSpeedsMbps.includes(speed),
      );
      const speedMbps = speeds?.sort((a, b) => b - a)[0];
      if (!sourcePort || !targetPort || !speedMbps) {
        setMessage("Hai port không có tốc độ tương thích.");
        return;
      }
      const fiberMedia = ["SFP", "SFP_PLUS", "SFP28", "QSFP28"];
      try {
        const created = await api<TopologyLink>("/api/links", {
          method: "POST",
          body: JSON.stringify({
            scenarioId: scenario.id,
            sourcePortId: sourcePort.id,
            targetPortId: targetPort.id,
            linkType:
              fiberMedia.includes(sourcePort.media) &&
              fiberMedia.includes(targetPort.media)
                ? "FIBER"
                : "ETHERNET",
            speedMbps,
          }),
        });
        setEdges((current) => addEdge(edgeFromLink(created), current));
        setNodes((current) =>
          current.map((node) => ({
            ...node,
            data: {
              ...node.data,
              ports: node.data.ports.map((port) => ({
                ...port,
                connected:
                  port.connected ||
                  port.id === created.sourcePortId ||
                  port.id === created.targetPortId,
              })),
            },
          })),
        );
        setMessage("Đã tạo physical link.");
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Không thể tạo link.",
        );
      }
    },
    [nodes, scenario, setEdges, setNodes],
  );

  async function savePositions() {
    try {
      await api(`/api/scenarios/${scenario.id}/topology`, {
        method: "PATCH",
        body: JSON.stringify({
          positions: nodes.map((node) => ({
            id: node.id,
            graphX: node.position.x,
            graphY: node.position.y,
          })),
        }),
      });
      setMessage("Đã lưu vị trí topology.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể lưu.");
    }
  }

  async function updateSelectedLink(formData: FormData) {
    if (!selectedEdgeId) return;
    const edge = edges.find((item) => item.id === selectedEdgeId);
    const link = edge?.data as TopologyLink | undefined;
    if (!link) return;
    try {
      const updated = await api<TopologyLink>(
        `/api/links/${link.id}?scenarioId=${scenario.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            ...link,
            status: formData.get("status"),
            cableLabel: formData.get("cableLabel") || null,
            lengthMeters: formData.get("lengthMeters")
              ? Number(formData.get("lengthMeters"))
              : null,
          }),
        },
      );
      setEdges((current) =>
        current.map((item) =>
          item.id === updated.id ? edgeFromLink(updated) : item,
        ),
      );
      setMessage("Đã cập nhật link.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không thể cập nhật.",
      );
    }
  }

  async function deleteSelectedLink() {
    if (!selectedEdgeId) return;
    const edge = edges.find((item) => item.id === selectedEdgeId);
    const link = edge?.data as TopologyLink | undefined;
    if (!link) return;
    try {
      await api(`/api/links/${link.id}?scenarioId=${scenario.id}`, {
        method: "DELETE",
      });
      setEdges((current) => current.filter((item) => item.id !== link.id));
      setNodes((current) =>
        current.map((node) => ({
          ...node,
          data: {
            ...node.data,
            ports: node.data.ports.map((port) => ({
              ...port,
              connected:
                port.id === link.sourcePortId || port.id === link.targetPortId
                  ? false
                  : port.connected,
            })),
          },
        })),
      );
      setSelectedEdgeId(null);
      setMessage("Đã xóa link.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể xóa.");
    }
  }

  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const selectedLink = edges.find((edge) => edge.id === selectedEdgeId)
    ?.data as TopologyLink | undefined;

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Button disabled={scenario.isLocked} onClick={savePositions}>
            <Save /> Save positions
          </Button>
          <span className="text-sm text-muted-foreground">
            Kéo từ port sang port để tạo link. {message}
          </span>
        </div>
        <div className="h-[68vh] min-h-[560px] overflow-hidden rounded-xl border bg-background">
          <ReactFlow
            connectionMode={ConnectionMode.Loose}
            edges={edges}
            fitView
            nodes={nodes}
            nodeTypes={nodeTypes}
            nodesDraggable={!scenario.isLocked}
            onConnect={onConnect}
            onEdgesChange={onEdgesChange}
            onEdgeClick={(_event, edge) => {
              setSelectedEdgeId(edge.id);
              setSelectedNodeId(null);
            }}
            onNodeClick={(_event, node) => {
              setSelectedNodeId(node.id);
              setSelectedEdgeId(null);
            }}
            onNodesChange={onNodesChange}
          >
            <Background />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>
      </div>
      <aside className="rounded-xl border bg-card p-5">
        <h2 className="text-lg font-bold">Inspector</h2>
        {!selectedNode && !selectedLink && (
          <p className="mt-3 text-sm text-muted-foreground">
            Chọn device hoặc physical link trên canvas.
          </p>
        )}
        {selectedNode && (
          <div className="mt-4 space-y-2 text-sm">
            <p className="text-xl font-bold text-primary">
              {selectedNode.data.hostname}
            </p>
            <p>{selectedNode.data.model}</p>
            <p>{selectedNode.data.category}</p>
            <p>{selectedNode.data.location}</p>
            <p>{selectedNode.data.ports.length} ports</p>
          </div>
        )}
        {selectedLink && (
          <form action={updateSelectedLink} className="mt-4 space-y-4">
            <div className="text-sm">
              <p className="font-semibold">{selectedLink.linkType}</p>
              <p className="text-muted-foreground">
                {selectedLink.speedMbps} Mbps · {selectedLink.duplex}
              </p>
            </div>
            <label className="block text-sm">
              Status
              <select
                className="mt-1 w-full rounded-md border bg-background p-2"
                defaultValue={selectedLink.status}
                name="status"
              >
                {(["PLANNED", "ACTIVE", "INACTIVE", "INVALID"] as const).map(
                  (status) => (
                    <option key={status}>{status}</option>
                  ),
                )}
              </select>
            </label>
            <label className="block text-sm">
              Cable label
              <input
                className="mt-1 w-full rounded-md border bg-background p-2"
                defaultValue={selectedLink.cableLabel ?? ""}
                name="cableLabel"
              />
            </label>
            <label className="block text-sm">
              Length (m)
              <input
                className="mt-1 w-full rounded-md border bg-background p-2"
                defaultValue={selectedLink.lengthMeters ?? ""}
                min="0"
                name="lengthMeters"
                step="0.1"
                type="number"
              />
            </label>
            <Button
              className="w-full"
              disabled={scenario.isLocked}
              type="submit"
            >
              Save link
            </Button>
            <Button
              className="w-full"
              disabled={scenario.isLocked}
              onClick={deleteSelectedLink}
              type="button"
              variant="destructive"
            >
              <Trash2 /> Delete link
            </Button>
          </form>
        )}
      </aside>
    </div>
  );
}
