import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Network } from "lucide-react";

export interface DeviceNodeData extends Record<string, unknown> {
  hostname: string;
  model: string;
  category: string;
  location: string;
  ports: Array<{
    id: string;
    name: string;
    media: string;
    supportedSpeedsMbps: number[];
    connected: boolean;
  }>;
}

export function DeviceNode({ data, selected }: NodeProps) {
  const device = data as DeviceNodeData;
  return (
    <div
      className={`min-w-56 rounded-xl border-2 bg-card shadow-xl ${selected ? "border-primary" : "border-border"}`}
    >
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Network className="size-5 text-primary" />
        <div>
          <div className="font-bold">{device.hostname}</div>
          <div className="text-xs text-muted-foreground">{device.model}</div>
        </div>
      </div>
      <div className="grid max-h-44 grid-cols-2 gap-1 overflow-y-auto p-3">
        {device.ports.map((port) => (
          <div
            className={`relative rounded px-2 py-1 text-[11px] ${port.connected ? "bg-primary/20 text-primary" : "bg-secondary"}`}
            key={port.id}
            title={`${port.media} · ${port.supportedSpeedsMbps.join("/")} Mbps`}
          >
            <Handle
              className="!size-2.5 !border-background !bg-primary"
              id={port.id}
              isConnectable={!port.connected}
              position={Position.Right}
              type="source"
            />
            {port.name}
          </div>
        ))}
      </div>
    </div>
  );
}
