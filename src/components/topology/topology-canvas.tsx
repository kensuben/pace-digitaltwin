"use client";

import {
  useMemo,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Cable,
  Check,
  ChevronRight,
  Cpu,
  Layers3,
  Monitor,
  Move,
  Network,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DeviceNodeData } from "@/components/topology/device-node";

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
interface Device {
  id: string;
  graphX: number;
  graphY: number;
  data: DeviceNodeData;
}
interface ModelOption {
  id: string;
  sku: string;
  modelName: string;
  category: string;
}
interface FloorOption {
  id: string;
  code: string;
  name: string;
  level: number;
  buildingId: string;
}
interface AvailableInventoryDevice {
  id: string;
  scenarioName: string;
  hostname: string;
  displayName: string;
  modelId: string;
  modelName: string;
  buildingId: string;
  floorId: string;
  floorCode: string;
}
interface CreatedDevice {
  id: string;
  hostname: string;
  displayName: string;
  building: { id: string; code: string };
  floor: { id: string; code: string; name: string; level: number };
  model: { category: string; modelName: string; vendor: { name: string } };
  ports: Array<{
    id: string;
    name: string;
    media: string;
    poeStandard: string;
    supportedSpeedsMbps: number[];
  }>;
}
interface StructureResult {
  readinessScore: number;
  summary: {
    floors: number;
    devices: number;
    links: number;
    unconnectedDevices: number;
  };
  vlans: Array<{ vlanId: number; name: string; cidr: string; purpose: string }>;
  recommendations: string[];
}

const groupedEndpointCategories = new Set(["DESKTOP_LAPTOP", "PRINTER"]);
const userNodesSelection = "__USER_NODES__";

async function api<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  const payload = (await response.json()) as {
    data: T | null;
    errors: Array<{ message: string }>;
  };
  if (!response.ok || payload.data === null)
    throw new Error(
      payload.errors[0]?.message ?? "Không thể hoàn tất thao tác.",
    );
  return payload.data;
}

export function TopologyCanvas({
  scenario,
  devices: initialDevices,
  links: initialLinks,
  models,
  availableFloors,
  availableInventoryDevices,
}: {
  scenario: { id: string; name: string; isLocked: boolean };
  devices: Device[];
  links: TopologyLink[];
  models: ModelOption[];
  availableFloors: FloorOption[];
  availableInventoryDevices: AvailableInventoryDevice[];
}) {
  const [devices, setDevices] = useState(initialDevices);
  const [links, setLinks] = useState(initialLinks);
  const buildingId = devices[0]?.data.buildingId;
  const floors = useMemo(
    () =>
      availableFloors
        .filter((floor) => !buildingId || floor.buildingId === buildingId)
        .sort((a, b) => a.level - b.level),
    [availableFloors, buildingId],
  );
  const serverFloor =
    floors.find((floor) => floor.code.toUpperCase() === "B2") ?? floors[0];
  const designFloors = floors.filter((floor) => floor.id !== serverFloor?.id);
  const [activeFloorId, setActiveFloorId] = useState(
    designFloors[0]?.id ?? serverFloor?.id ?? "",
  );
  const [floorDeviceId, setFloorDeviceId] = useState("");
  const [serverDeviceId, setServerDeviceId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [structure, setStructure] = useState<StructureResult | null>(null);
  const [localDeviceId, setLocalDeviceId] = useState("");
  const [localSwitchId, setLocalSwitchId] = useState("");
  const [localScope, setLocalScope] = useState<"FLOOR" | "B2">("FLOOR");
  const [showAdd, setShowAdd] = useState(false);
  const [addTargetFloorId, setAddTargetFloorId] = useState("");
  const [nodeEditMode, setNodeEditMode] = useState(false);
  const [newHostname, setNewHostname] = useState("");
  const [newModelId, setNewModelId] = useState("");
  const [bulkModelId, setBulkModelId] = useState("");
  const [bulkCount, setBulkCount] = useState(1);
  const [existingInventoryDeviceId, setExistingInventoryDeviceId] =
    useState("");
  const serverDevices = devices.filter(
    (device) => device.data.floorId === serverFloor?.id,
  );
  const floorDevices = devices.filter(
    (device) => device.data.floorId === activeFloorId,
  );
  const activeFloor = floors.find((floor) => floor.id === activeFloorId);
  const addTargetFloor =
    floors.find((floor) => floor.id === addTargetFloorId) ?? activeFloor;
  const addTargetDevices = devices.filter(
    (device) => device.data.floorId === addTargetFloor?.id,
  );
  const reusableInventoryDevices = useMemo(() => {
    const usedHostnames = new Set(
      devices.map((device) => device.data.hostname),
    );
    const seen = new Set<string>();
    return availableInventoryDevices.filter((device) => {
      const key = `${device.floorId}:${device.hostname}:${device.modelId}`;
      if (
        device.floorId !== addTargetFloor?.id ||
        usedHostnames.has(device.hostname) ||
        seen.has(key)
      )
        return false;
      seen.add(key);
      return true;
    });
  }, [addTargetFloor?.id, availableInventoryDevices, devices]);
  const localDevices = localScope === "B2" ? serverDevices : floorDevices;
  const localEndpointDevices = localDevices.filter((device) =>
    groupedEndpointCategories.has(device.data.category),
  );
  const localSourceDevices = localDevices.filter(
    (device) => !groupedEndpointCategories.has(device.data.category),
  );
  const localFloorCode =
    localScope === "B2"
      ? (serverFloor?.code ?? "B2")
      : (activeFloor?.code ?? "Tầng");
  const localTargetSwitches = devices.filter((device) => {
    const categories =
      localScope === "B2"
        ? ["CORE_SWITCH", "ACCESS_SWITCH", "DISTRIBUTION_SWITCH"]
        : ["ACCESS_SWITCH", "DISTRIBUTION_SWITCH"];
    if (!categories.includes(device.data.category)) return false;
    if (localScope === "B2") return device.data.floorId === serverFloor?.id;
    return (
      device.data.buildingId === buildingId &&
      device.data.floorId !== serverFloor?.id
    );
  });
  const connectionStates = useMemo(() => {
    const states = new Map<
      string,
      { local: boolean; uplink: boolean; shared: boolean }
    >();
    for (const link of links) {
      const source = devices.find(
        (device) => device.id === link.sourceDeviceId,
      );
      const target = devices.find(
        (device) => device.id === link.targetDeviceId,
      );
      if (!source || !target) continue;
      const local = source.data.floorId === target.data.floorId;
      const uplink =
        !local &&
        [source.data.floorId, target.data.floorId].includes(
          serverFloor?.id ?? "",
        );
      const shared = !local && !uplink;
      for (const id of [source.id, target.id]) {
        const current = states.get(id) ?? {
          local: false,
          uplink: false,
          shared: false,
        };
        states.set(id, {
          local: current.local || local,
          uplink: current.uplink || uplink,
          shared: current.shared || shared,
        });
      }
    }
    return states;
  }, [devices, links, serverFloor?.id]);

  function bestPortPair(
    a: Device,
    b: Device,
    reserved = new Set<string>(),
    requireTargetPoe = false,
  ) {
    for (const source of a.data.ports
      .filter((port) => !port.connected && !reserved.has(port.id))
      .sort(
        (x, y) =>
          Math.max(...y.supportedSpeedsMbps) -
          Math.max(...x.supportedSpeedsMbps),
      )) {
      const target = b.data.ports
        .filter(
          (port) =>
            !port.connected &&
            !reserved.has(port.id) &&
            (!requireTargetPoe || port.poeStandard !== "NONE"),
        )
        .find((port) =>
          port.supportedSpeedsMbps.some((speed) =>
            source.supportedSpeedsMbps.includes(speed),
          ),
        );
      if (target)
        return {
          source,
          target,
          speedMbps: source.supportedSpeedsMbps
            .filter((speed) => target.supportedSpeedsMbps.includes(speed))
            .sort((x, y) => y - x)[0],
        };
    }
    return null;
  }
  const needsPoe = (device: Device) =>
    ["AP", "CAMERA"].includes(device.data.category);
  async function connect(
    a: Device,
    b: Device,
    label: string,
    reserved = new Set<string>(),
    requireTargetPoe = false,
  ) {
    const pair = bestPortPair(a, b, reserved, requireTargetPoe);
    if (!pair)
      throw new Error(
        `${a.data.hostname} và ${b.data.hostname} không còn port${requireTargetPoe ? " PoE" : ""} tương thích.`,
      );
    const fiber = ["SFP", "SFP_PLUS", "SFP28", "QSFP28"];
    const created = await api<TopologyLink>("/api/links", {
      method: "POST",
      body: JSON.stringify({
        scenarioId: scenario.id,
        sourcePortId: pair.source.id,
        targetPortId: pair.target.id,
        linkType:
          fiber.includes(pair.source.media) && fiber.includes(pair.target.media)
            ? "FIBER"
            : "ETHERNET",
        speedMbps: pair.speedMbps,
        cableLabel: label,
      }),
    });
    reserved.add(pair.source.id);
    reserved.add(pair.target.id);
    setLinks((current) => [...current, created]);
    setDevices((current) =>
      current.map((device) => ({
        ...device,
        data: {
          ...device.data,
          ports: device.data.ports.map((port) => ({
            ...port,
            connected:
              port.connected ||
              port.id === created.sourcePortId ||
              port.id === created.targetPortId,
          })),
        },
      })),
    );
    return created;
  }
  async function manualConnect() {
    const floorDevice = devices.find((d) => d.id === floorDeviceId);
    const serverDevice = devices.find((d) => d.id === serverDeviceId);
    if (!floorDevice || !serverDevice) return;
    setBusy(true);
    try {
      await connect(
        floorDevice,
        serverDevice,
        `${activeFloor?.code}-TO-${serverFloor?.code}`,
      );
      setMessage(
        `Đã nối ${floorDevice.data.hostname} về ${serverDevice.data.hostname}.`,
      );
      setFloorDeviceId("");
      setServerDeviceId("");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không thể tạo uplink.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function autoMap() {
    setBusy(true);
    setMessage("");
    let created = 0;
    try {
      const priority = (d: Device) =>
        ["DISTRIBUTION_SWITCH", "ACCESS_SWITCH"].includes(d.data.category);
      const core = serverDevices.filter((d) =>
        ["CORE_SWITCH", "FIREWALL"].includes(d.data.category),
      );
      const uplinks = floorDevices.filter(
        (d) => priority(d) && !connectionStates.get(d.id)?.uplink,
      );
      const reserved = new Set(
        links.flatMap((link) => [link.sourcePortId, link.targetPortId]),
      );
      for (const [index, device] of uplinks.entries()) {
        const target = core[index % Math.max(core.length, 1)];
        if (target) {
          await connect(
            device,
            target,
            `${activeFloor?.code}-AUTO-${index + 1}`,
            reserved,
          );
          created++;
        }
      }
      setMessage(
        created
          ? `Đã tự động tạo ${created} uplink từ ${activeFloor?.code} về ${serverFloor?.code}.`
          : `Không tìm thấy switch chưa kết nối hoặc Core còn port phù hợp.`,
      );
    } catch (error) {
      setMessage(
        `${created} link đã tạo. ${error instanceof Error ? error.message : "Auto mapping dừng."}`,
      );
    } finally {
      setBusy(false);
    }
  }
  async function applyDualUplinkPolicy() {
    setBusy(true);
    setMessage("");
    const cores = serverDevices.filter(
      (device) => device.data.category === "CORE_SWITCH",
    );
    const floorSwitches = floorDevices.filter((device) =>
      ["ACCESS_SWITCH", "DISTRIBUTION_SWITCH"].includes(device.data.category),
    );
    if (cores.length < 2) {
      setMessage("Chính sách Dual Uplink cần tối thiểu 2 Core Switch tại B2.");
      setBusy(false);
      return;
    }
    const coreIds = new Set(cores.map((core) => core.id));
    const reserved = new Set(
      links.flatMap((link) => [link.sourcePortId, link.targetPortId]),
    );
    let created = 0;
    let redundantSwitches = 0;
    try {
      for (const floorSwitch of floorSwitches) {
        const connectedCoreIds = new Set<string>();
        for (const link of links) {
          if (
            link.sourceDeviceId === floorSwitch.id &&
            coreIds.has(link.targetDeviceId)
          )
            connectedCoreIds.add(link.targetDeviceId);
          if (
            link.targetDeviceId === floorSwitch.id &&
            coreIds.has(link.sourceDeviceId)
          )
            connectedCoreIds.add(link.sourceDeviceId);
        }
        for (const core of cores) {
          if (connectedCoreIds.size >= 2) break;
          if (connectedCoreIds.has(core.id)) continue;
          if (!bestPortPair(floorSwitch, core, reserved)) continue;
          await connect(
            floorSwitch,
            core,
            `${activeFloor?.code}-DUAL-${floorSwitch.data.hostname}-${connectedCoreIds.size + 1}`,
            reserved,
          );
          connectedCoreIds.add(core.id);
          created++;
        }
        if (connectedCoreIds.size >= 2) redundantSwitches++;
      }
      setMessage(
        floorSwitches.length
          ? `Dual Uplink: tạo ${created} link; ${redundantSwitches}/${floorSwitches.length} switch đã kết nối tới 2 Core B2 khác nhau.`
          : `Không có Access/Distribution switch tại ${activeFloor?.code} để áp dụng Dual Uplink.`,
      );
    } catch (error) {
      setMessage(
        `Dual Uplink đã tạo ${created} link. ${error instanceof Error ? error.message : "Không thể hoàn tất policy."}`,
      );
    } finally {
      setBusy(false);
    }
  }
  async function localConnect() {
    const localSwitch = devices.find((d) => d.id === localSwitchId);
    if (!localSwitch) return;
    setBusy(true);
    if (localDeviceId === userNodesSelection) {
      const pending = localEndpointDevices.filter(
        (device) =>
          !connectionStates.get(device.id)?.local &&
          !connectionStates.get(device.id)?.shared,
      );
      const reserved = new Set(
        links.flatMap((link) => [link.sourcePortId, link.targetPortId]),
      );
      let created = 0;
      try {
        for (const endpoint of pending) {
          await connect(
            endpoint,
            localSwitch,
            `${localFloorCode}-USER-NODE-${created + 1}`,
            reserved,
          );
          created++;
        }
        const shared =
          localSwitch.data.floorId !== activeFloorId && localScope === "FLOOR";
        setMessage(
          pending.length
            ? `Đã nối ${created} User Nodes vào ${localSwitch.data.hostname}${shared ? ` dùng chung tại ${localSwitch.data.floorCode}` : ` tại ${localFloorCode}`}.`
            : `Tất cả User Nodes tại ${localFloorCode} đã được mapping local.`,
        );
        setLocalDeviceId("");
        setLocalSwitchId("");
      } catch (error) {
        setMessage(
          `Đã nối ${created}/${pending.length} User Nodes. ${error instanceof Error ? error.message : "Không còn port tương thích."}`,
        );
      } finally {
        setBusy(false);
      }
      return;
    }
    const endpoint = devices.find((d) => d.id === localDeviceId);
    if (!endpoint) {
      setBusy(false);
      return;
    }
    try {
      await connect(
        endpoint,
        localSwitch,
        `${localFloorCode}-LOCAL`,
        new Set(),
        needsPoe(endpoint),
      );
      setMessage(
        localSwitch.data.floorId !== endpoint.data.floorId
          ? `Đã nối cross-floor ${endpoint.data.hostname} vào ${localSwitch.data.hostname} dùng chung tại ${localSwitch.data.floorCode}.`
          : `Đã nối local ${endpoint.data.hostname} vào ${localSwitch.data.hostname} tại ${localFloorCode}.`,
      );
      setLocalDeviceId("");
      setLocalSwitchId("");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không thể mapping local.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function autoLocalMap() {
    setBusy(true);
    setMessage("");
    let created = 0;
    try {
      const switchCategories =
        localScope === "B2"
          ? ["CORE_SWITCH", "ACCESS_SWITCH", "DISTRIBUTION_SWITCH"]
          : ["ACCESS_SWITCH", "DISTRIBUTION_SWITCH"];
      const reserved = new Set(
        links.flatMap((link) => [link.sourcePortId, link.targetPortId]),
      );
      const switches = localDevices
        .filter((d) => switchCategories.includes(d.data.category))
        .sort(
          (a, b) =>
            Number(b.data.hostname.includes("POE")) -
            Number(a.data.hostname.includes("POE")),
        );
      const endpoints = localDevices.filter(
        (d) =>
          !switchCategories.includes(d.data.category) &&
          !connectionStates.get(d.id)?.local &&
          !connectionStates.get(d.id)?.shared,
      );
      for (const endpoint of endpoints) {
        const requiresPoe = needsPoe(endpoint);
        const candidates = requiresPoe
          ? [...switches].sort(
              (a, b) =>
                Number(b.data.ports.some((p) => p.poeStandard !== "NONE")) -
                Number(a.data.ports.some((p) => p.poeStandard !== "NONE")),
            )
          : switches;
        for (const target of candidates) {
          if (bestPortPair(endpoint, target, reserved, requiresPoe)) {
            await connect(
              endpoint,
              target,
              `${localFloorCode}-LOCAL-${created + 1}`,
              reserved,
              requiresPoe,
            );
            created++;
            break;
          }
        }
      }
      setMessage(
        created
          ? `Đã tạo ${created} kết nối local tại ${localFloorCode}.`
          : `Không còn thiết bị hoặc port local phù hợp tại ${localFloorCode}.`,
      );
    } catch (error) {
      setMessage(
        `${created} link đã tạo. ${error instanceof Error ? error.message : "Auto local mapping dừng."}`,
      );
    } finally {
      setBusy(false);
    }
  }
  async function reuseInventoryDevice() {
    const source = reusableInventoryDevices.find(
      (device) => device.id === existingInventoryDeviceId,
    );
    if (!source || !addTargetFloor) return;
    setBusy(true);
    try {
      const created = await api<CreatedDevice>("/api/inventory", {
        method: "POST",
        body: JSON.stringify({
          scenarioId: scenario.id,
          hostname: source.hostname,
          displayName: source.displayName,
          modelId: source.modelId,
          buildingId: addTargetFloor.buildingId,
          floorId: addTargetFloor.id,
          notes: `Reused from Inventory scenario: ${source.scenarioName}.`,
        }),
      });
      setDevices((current) => [...current, toDevice(created)]);
      setExistingInventoryDeviceId("");
      setShowAdd(false);
      setMessage(
        `Đã đưa ${created.hostname} từ Inventory vào ${addTargetFloor.code}.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không thể sử dụng thiết bị Inventory.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function addDevice() {
    if (!addTargetFloor || !newHostname || !newModelId) return;
    const reference = addTargetDevices[0] ?? serverDevices[0] ?? devices[0];
    if (!reference) return;
    setBusy(true);
    try {
      const created = await api<CreatedDevice>("/api/inventory", {
        method: "POST",
        body: JSON.stringify({
          scenarioId: scenario.id,
          hostname: newHostname,
          displayName: newHostname,
          modelId: newModelId,
          buildingId: addTargetFloor.buildingId ?? reference.data.buildingId,
          floorId: addTargetFloor.id,
          notes: "Added from Floor Topology designer.",
        }),
      });
      setDevices((current) => [...current, toDevice(created)]);
      setNewHostname("");
      setNewModelId("");
      setShowAdd(false);
      setMessage(`Đã thêm ${created.hostname} vào ${addTargetFloor.code}.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không thể thêm thiết bị.",
      );
    } finally {
      setBusy(false);
    }
  }
  function toDevice(created: CreatedDevice): Device {
    return {
      id: created.id,
      graphX: 0,
      graphY: 0,
      data: {
        hostname: created.hostname,
        model: `${created.model.vendor.name} ${created.model.modelName}`,
        category: created.model.category,
        location: `${created.building.code} / ${created.floor.code}`,
        buildingId: created.building.id,
        floorId: created.floor.id,
        floorCode: created.floor.code,
        floorName: created.floor.name,
        floorLevel: created.floor.level,
        ports: created.ports.map((port) => ({ ...port, connected: false })),
      },
    };
  }
  async function bulkAddNodes() {
    if (!addTargetFloor || !bulkModelId || bulkCount < 1) return;
    const reference = addTargetDevices[0] ?? serverDevices[0] ?? devices[0];
    const model = models.find((item) => item.id === bulkModelId);
    if (!reference || !model) return;
    setBusy(true);
    let completed = 0;
    const createdDevices: Device[] = [];
    const prefix =
      model.category === "DESKTOP_LAPTOP"
        ? "NODE"
        : model.category === "PRINTER"
          ? "PRN"
          : "CAM";
    let sequence =
      Math.max(
        0,
        ...addTargetDevices
          .filter((device) =>
            device.data.hostname.startsWith(
              `${prefix}-${addTargetFloor.code}-`,
            ),
          )
          .map((device) => Number(device.data.hostname.split("-").at(-1)) || 0),
      ) + 1;
    try {
      for (let index = 0; index < bulkCount; index++) {
        const hostname = `${prefix}-${addTargetFloor.code}-${String(sequence++).padStart(2, "0")}`;
        const created = await api<CreatedDevice>("/api/inventory", {
          method: "POST",
          body: JSON.stringify({
            scenarioId: scenario.id,
            hostname,
            displayName: `${model.modelName} ${addTargetFloor.code} ${sequence - 1}`,
            modelId: model.id,
            buildingId: addTargetFloor.buildingId ?? reference.data.buildingId,
            floorId: addTargetFloor.id,
            notes: "Bulk planning node from Floor Topology designer.",
          }),
        });
        createdDevices.push(toDevice(created));
        completed++;
      }
      setDevices((current) => [...current, ...createdDevices]);
      setMessage(
        `Đã thêm ${completed} node ${model.category} vào ${addTargetFloor.code}.`,
      );
      setBulkCount(1);
    } catch (error) {
      if (createdDevices.length)
        setDevices((current) => [...current, ...createdDevices]);
      setMessage(
        `Đã thêm ${completed}/${bulkCount} node. ${error instanceof Error ? error.message : "Bulk create dừng."}`,
      );
    } finally {
      setBusy(false);
    }
  }
  async function removeDevice(device: Device) {
    if (
      !confirm(
        `Gỡ ${device.data.hostname} khỏi phương án? Các link và cable route liên quan cũng sẽ bị xóa.`,
      )
    )
      return;
    setBusy(true);
    try {
      await api(`/api/inventory/${device.id}?scenarioId=${scenario.id}`, {
        method: "DELETE",
      });
      setDevices((current) => current.filter((item) => item.id !== device.id));
      setLinks((current) =>
        current.filter(
          (link) =>
            link.sourceDeviceId !== device.id &&
            link.targetDeviceId !== device.id,
        ),
      );
      setMessage(`Đã gỡ ${device.data.hostname} và các kết nối liên quan.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không thể gỡ thiết bị.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function removeLink(link: TopologyLink) {
    try {
      await api(`/api/links/${link.id}?scenarioId=${scenario.id}`, {
        method: "DELETE",
      });
      setLinks((current) => current.filter((item) => item.id !== link.id));
      setDevices((current) =>
        current.map((device) => ({
          ...device,
          data: {
            ...device.data,
            ports: device.data.ports.map((port) => ({
              ...port,
              connected:
                port.id === link.sourcePortId || port.id === link.targetPortId
                  ? false
                  : port.connected,
            })),
          },
        })),
      );
      setMessage("Đã gỡ kết nối.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể gỡ link.");
    }
  }
  async function calculate() {
    setBusy(true);
    try {
      setStructure(
        await api<StructureResult>(
          `/api/scenarios/${scenario.id}/network-structure/calculate`,
          { method: "POST" },
        ),
      );
      setMessage("Đã tính Network Structure từ topology hiện tại.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không thể tính cấu trúc mạng.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function approveStructure() {
    setBusy(true);
    try {
      const result = await api<{
        createdVlans: number;
        updatedVlans: number;
        createdSubnets: number;
        updatedSubnets: number;
        total: number;
      }>(`/api/scenarios/${scenario.id}/network-structure/approve`, {
        method: "POST",
      });
      setMessage(
        `Đã lưu ${result.total} đề xuất: ${result.createdVlans} VLAN mới, ${result.updatedVlans} VLAN cập nhật, ${result.createdSubnets} subnet mới, ${result.updatedSubnets} subnet cập nhật.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không thể lưu Network Structure.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border bg-card/90 p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            <Layers3 size={13} className="text-primary" />
            Chọn tầng thiết kế
          </div>
          <div className="flex flex-wrap gap-1.5">
            {designFloors.map((floor) => (
              <button
                key={floor.id}
                onClick={() => {
                  setActiveFloorId(floor.id);
                  setStructure(null);
                }}
                className={`h-9 min-w-11 rounded-xl px-3 text-sm font-bold transition-all ${activeFloorId === floor.id ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 ring-1 ring-primary/60" : "bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
              >
                {floor.code}
              </button>
            ))}
          </div>
        </div>
        <div className="grid shrink-0 gap-1.5 rounded-xl border bg-background/40 p-1.5 sm:grid-cols-3 lg:flex lg:items-center">
          <Button
            variant="outline"
            size="sm"
            className="whitespace-nowrap border-transparent bg-transparent hover:border-border hover:bg-secondary"
            disabled={busy || scenario.isLocked}
            onClick={autoMap}
          >
            <Sparkles size={17} />
            Tự nhận diện & đấu nối
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="whitespace-nowrap border-transparent bg-transparent hover:border-border hover:bg-secondary"
            disabled={busy || scenario.isLocked}
            onClick={applyDualUplinkPolicy}
          >
            <Cable size={17} />
            Dual Uplink
          </Button>
          <Button
            size="sm"
            className="whitespace-nowrap shadow-md shadow-primary/20"
            disabled={busy}
            onClick={calculate}
          >
            <Cpu size={17} />
            Tính Network Structure
          </Button>
        </div>
      </div>
      {message && (
        <p className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
          {message}
        </p>
      )}
      <section className="rounded-2xl border bg-card p-3 lg:p-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(360px,40%)_minmax(0,60%)]">
          <div className="flex flex-col gap-4">
            <FloorPanel
              title={`${activeFloor?.code ?? "Tầng"} · ${activeFloor?.name ?? "Chưa chọn"}`}
              subtitle="Tầng đang thiết kế"
              devices={floorDevices}
              connectionStates={connectionStates}
              tone="floor"
              editable={!scenario.isLocked}
              onRemove={removeDevice}
              onAdd={() => {
                setNodeEditMode(false);
                setAddTargetFloorId(activeFloor?.id ?? "");
                setShowAdd(true);
              }}
              onEditNodes={() => {
                setBulkModelId(
                  models.find((model) => model.category === "DESKTOP_LAPTOP")
                    ?.id ??
                    models.find((model) => model.category === "PRINTER")?.id ??
                    "",
                );
                setNodeEditMode(true);
                setAddTargetFloorId(activeFloor?.id ?? "");
                setShowAdd(true);
              }}
              compact
            />
            <FloorPanel
              title={`${serverFloor?.code ?? "B2"} · Server Room`}
              subtitle="Điểm hội tụ cố định"
              devices={serverDevices}
              connectionStates={connectionStates}
              tone="server"
              editable={!scenario.isLocked}
              onRemove={removeDevice}
              onAdd={() => {
                setNodeEditMode(false);
                setAddTargetFloorId(serverFloor?.id ?? "");
                setShowAdd(true);
              }}
              onEditNodes={() => {
                setBulkModelId(
                  models.find((model) => model.category === "DESKTOP_LAPTOP")
                    ?.id ??
                    models.find((model) => model.category === "PRINTER")?.id ??
                    "",
                );
                setNodeEditMode(true);
                setAddTargetFloorId(serverFloor?.id ?? "");
                setShowAdd(true);
              }}
              compact
            />
          </div>
          <OrganizationTopology
            key={activeFloorId}
            devices={devices}
            links={links}
            activeFloorId={activeFloorId}
            serverFloorId={serverFloor?.id ?? ""}
            floorLabel={activeFloor?.code ?? "Tầng"}
            scenarioId={scenario.id}
            locked={scenario.isLocked}
            onPositionsSaved={(savedPositions) =>
              setDevices((current) =>
                current.map((device) => {
                  const saved = savedPositions.find(
                    (position) => position.id === device.id,
                  );
                  return saved
                    ? { ...device, graphX: saved.graphX, graphY: saved.graphY }
                    : device;
                }),
              )
            }
          />
        </div>
      </section>
      {showAdd && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy)
              setShowAdd(false);
          }}
        >
          <section
            aria-labelledby="add-floor-device-title"
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-4xl overflow-x-hidden overflow-y-auto rounded-2xl border border-primary/40 bg-card p-5 shadow-2xl"
            role="dialog"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-bold" id="add-floor-device-title">
                  {nodeEditMode
                    ? "Cập nhật User Nodes tại"
                    : "Thêm thiết bị vào"}{" "}
                  {addTargetFloor?.code}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Vị trí đích: {addTargetFloor?.name}.{" "}
                  {nodeEditMode
                    ? `Hiện có ${addTargetDevices.filter((device) => groupedEndpointCategories.has(device.data.category)).length} User Nodes; nhập số lượng cần bổ sung.`
                    : "Thêm riêng lẻ hoặc nhập số node endpoint/camera."}
                </p>
              </div>
              <button
                aria-label="Đóng hộp thoại thêm thiết bị"
                className="rounded-lg p-2 hover:bg-secondary disabled:opacity-50"
                disabled={busy}
                onClick={() => setShowAdd(false)}
              >
                <X size={19} />
              </button>
            </div>
            {!nodeEditMode && (
              <div className="mt-4 rounded-xl border border-primary/25 bg-primary/5 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold">
                      Dùng thiết bị có sẵn trong Inventory
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Thiết bị đã gán {addTargetFloor?.code} ở scenario khác và
                      chưa có trong phương án này.
                    </p>
                  </div>
                  <span className="rounded-full bg-primary/15 px-2 py-1 text-xs font-bold text-primary">
                    {reusableInventoryDevices.length} khả dụng
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                  <select
                    className="min-w-0 rounded-xl border bg-background px-3 py-3 text-sm"
                    value={existingInventoryDeviceId}
                    onChange={(event) =>
                      setExistingInventoryDeviceId(event.target.value)
                    }
                  >
                    <option value="">Chọn thiết bị chưa sử dụng…</option>
                    {reusableInventoryDevices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.hostname} · {device.modelName} ·{" "}
                        {device.scenarioName}
                      </option>
                    ))}
                  </select>
                  <Button
                    disabled={busy || !existingInventoryDeviceId}
                    onClick={reuseInventoryDevice}
                  >
                    <Plus size={17} />
                    {busy ? "Đang thêm…" : "Dùng thiết bị này"}
                  </Button>
                </div>
              </div>
            )}
            {!nodeEditMode && (
              <div className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-[0.7fr_1.3fr_auto]">
                <input
                  autoFocus
                  className="rounded-xl border bg-background px-3 py-3 text-sm"
                  placeholder="Hostname, VD: SERVER-01"
                  value={newHostname}
                  onChange={(e) => setNewHostname(e.target.value)}
                />
                <select
                  className="rounded-xl border bg-background px-3 py-3 text-sm"
                  value={newModelId}
                  onChange={(e) => setNewModelId(e.target.value)}
                >
                  <option value="">Chọn model từ Catalog…</option>
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.sku} · {model.modelName}
                    </option>
                  ))}
                </select>
                <Button
                  disabled={busy || !newHostname || !newModelId}
                  onClick={addDevice}
                >
                  <Plus size={17} />
                  {busy ? "Đang thêm…" : "Thêm thiết bị"}
                </Button>
              </div>
            )}
            <div className={`${nodeEditMode ? "mt-4" : "mt-5 border-t pt-4"}`}>
              <p className="mb-3 text-sm font-bold">
                Bổ sung User Nodes vào {addTargetFloor?.code}
              </p>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_7rem_auto]">
                <select
                  autoFocus={nodeEditMode}
                  className="min-w-0 rounded-xl border bg-background px-3 py-3 text-sm"
                  value={bulkModelId}
                  onChange={(e) => setBulkModelId(e.target.value)}
                >
                  <option value="">Desktop/Laptop hoặc Máy in…</option>
                  {models
                    .filter((model) =>
                      nodeEditMode
                        ? ["DESKTOP_LAPTOP", "PRINTER"].includes(model.category)
                        : ["DESKTOP_LAPTOP", "PRINTER", "CAMERA"].includes(
                            model.category,
                          ),
                    )
                    .map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.category} · {model.sku} · {model.modelName}
                      </option>
                    ))}
                </select>
                <input
                  className="rounded-xl border bg-background px-3 py-3 text-sm"
                  min="1"
                  max="200"
                  type="number"
                  value={bulkCount}
                  onChange={(e) =>
                    setBulkCount(
                      Math.max(1, Math.min(200, Number(e.target.value))),
                    )
                  }
                />
                <Button
                  disabled={busy || !bulkModelId || bulkCount < 1}
                  onClick={bulkAddNodes}
                >
                  <Plus size={17} />
                  {busy ? "Đang tạo…" : `Thêm ${bulkCount} node`}
                </Button>
              </div>
            </div>
          </section>
        </div>
      )}
      <section className="rounded-2xl border bg-card p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Network className="text-primary" />
            <div>
              <h2 className="font-bold">Local mapping · {localFloorCode}</h2>
              <p className="text-sm text-muted-foreground">
                Thiết bị → switch cùng tầng hoặc switch dùng chung tại tầng
                khác. Chọn User Nodes để mapping hàng loạt.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-xl bg-secondary p-1">
              <button
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${localScope === "FLOOR" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                onClick={() => {
                  setLocalScope("FLOOR");
                  setLocalDeviceId("");
                  setLocalSwitchId("");
                }}
              >
                Tầng {activeFloor?.code}
              </button>
              <button
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${localScope === "B2" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                onClick={() => {
                  setLocalScope("B2");
                  setLocalDeviceId("");
                  setLocalSwitchId("");
                }}
              >
                B2 Server
              </button>
            </div>
            <Button
              variant="outline"
              disabled={busy || scenario.isLocked}
              onClick={autoLocalMap}
            >
              <Sparkles size={17} />
              Tự đấu nối local
            </Button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <select
            className="rounded-xl border bg-background px-3 py-3 text-sm"
            value={localDeviceId}
            onChange={(e) => {
              setLocalDeviceId(e.target.value);
              if (e.target.value === localSwitchId) setLocalSwitchId("");
            }}
          >
            <option value="">
              Thiết bị / switch nguồn tại {localFloorCode}…
            </option>
            {localEndpointDevices.length > 0 && (
              <option value={userNodesSelection}>
                USER NODES · {localEndpointDevices.length} node (
                {
                  localEndpointDevices.filter(
                    (device) =>
                      !connectionStates.get(device.id)?.local &&
                      !connectionStates.get(device.id)?.shared,
                  ).length
                }{" "}
                chưa kết nối)
              </option>
            )}
            {localSourceDevices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.data.hostname} · {d.data.category}
              </option>
            ))}
          </select>
          <select
            className="rounded-xl border bg-background px-3 py-3 text-sm"
            value={localSwitchId}
            onChange={(e) => setLocalSwitchId(e.target.value)}
          >
            <option value="">Switch local đích…</option>
            {localTargetSwitches
              .filter(
                (d) =>
                  d.id !== localDeviceId &&
                  (localScope === "B2"
                    ? ["CORE_SWITCH", "ACCESS_SWITCH", "DISTRIBUTION_SWITCH"]
                    : ["ACCESS_SWITCH", "DISTRIBUTION_SWITCH"]
                  ).includes(d.data.category),
              )
              .sort(
                (a, b) =>
                  Number(b.data.hostname.includes("POE")) -
                  Number(a.data.hostname.includes("POE")),
              )
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.data.hostname} ·{" "}
                  {d.data.floorId === activeFloorId || localScope === "B2"
                    ? "Cùng tầng"
                    : `Dùng chung từ ${d.data.floorCode}`}{" "}
                  ·{" "}
                  {
                    d.data.ports.filter(
                      (p) => p.poeStandard !== "NONE" && !p.connected,
                    ).length
                  }{" "}
                  PoE · {d.data.ports.filter((p) => !p.connected).length} port
                  trống
                </option>
              ))}
          </select>
          <Button
            disabled={
              busy || !localDeviceId || !localSwitchId || scenario.isLocked
            }
            onClick={localConnect}
          >
            {busy ? "Đang mapping…" : "Tạo local link"}{" "}
            <ChevronRight size={17} />
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-5 border-t pt-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <i className="h-2.5 w-2.5 rounded-full bg-blue-400" />
            Local cùng tầng
          </span>
          <span className="flex items-center gap-2">
            <i className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            Uplink về B2
          </span>
          <span className="flex items-center gap-2">
            <i className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            Switch dùng chung tầng khác
          </span>
          <span className="flex items-center gap-2">
            <i className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-blue-400 to-emerald-400" />
            Có cả local và uplink
          </span>
        </div>
      </section>
      <section className="rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-3">
          <Cable className="text-primary" />
          <div>
            <h2 className="font-bold">Mapping tầng → B2</h2>
            <p className="text-sm text-muted-foreground">
              Chọn thiết bị; hệ thống tự chọn cặp port có tốc độ cao nhất còn
              trống.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <select
            className="rounded-xl border bg-background px-3 py-3 text-sm"
            value={floorDeviceId}
            onChange={(e) => setFloorDeviceId(e.target.value)}
          >
            <option value="">Thiết bị tại {activeFloor?.code}…</option>
            {floorDevices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.data.hostname} · {d.data.category}
              </option>
            ))}
          </select>
          <select
            className="rounded-xl border bg-background px-3 py-3 text-sm"
            value={serverDeviceId}
            onChange={(e) => setServerDeviceId(e.target.value)}
          >
            <option value="">Thiết bị đích tại {serverFloor?.code}…</option>
            {serverDevices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.data.hostname} · {d.data.category}
              </option>
            ))}
          </select>
          <Button
            className="h-11"
            disabled={
              busy || !floorDeviceId || !serverDeviceId || scenario.isLocked
            }
            onClick={manualConnect}
          >
            Tạo uplink <ChevronRight size={17} />
          </Button>
        </div>
        <div className="mt-5 space-y-2">
          {links
            .filter((link) => {
              const a = devices.find((d) => d.id === link.sourceDeviceId);
              const b = devices.find((d) => d.id === link.targetDeviceId);
              return [a?.data.floorId, b?.data.floorId].includes(activeFloorId);
            })
            .map((link) => {
              const a = devices.find((d) => d.id === link.sourceDeviceId);
              const b = devices.find((d) => d.id === link.targetDeviceId);
              return (
                <div
                  className="flex items-center justify-between rounded-xl bg-secondary/60 px-4 py-3 text-sm"
                  key={link.id}
                >
                  <span>
                    <b>{a?.data.hostname}</b> ↔ <b>{b?.data.hostname}</b> ·{" "}
                    {link.speedMbps >= 1000
                      ? `${link.speedMbps / 1000}G`
                      : `${link.speedMbps}M`}
                  </span>
                  <button
                    aria-label="Gỡ kết nối"
                    disabled={scenario.isLocked}
                    onClick={() => removeLink(link)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
        </div>
      </section>
      {structure && (
        <section className="rounded-2xl border border-primary/40 bg-primary/5 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                Network readiness {structure.readinessScore}%
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                Đề xuất VLAN & IP Addressing
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy || scenario.isLocked}
                onClick={approveStructure}
              >
                <Save size={17} />
                {busy ? "Đang lưu…" : "Duyệt & lưu cấu hình"}
              </Button>
              <a
                href={`/network-config/${scenario.id}`}
                className="rounded-xl border px-5 py-3 text-sm font-bold hover:bg-secondary"
              >
                Mở cấu hình chi tiết
              </a>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {structure.vlans.map((vlan) => (
              <div className="rounded-xl border bg-card p-4" key={vlan.vlanId}>
                <p className="text-xs text-muted-foreground">
                  VLAN {vlan.vlanId}
                </p>
                <p className="mt-1 font-bold">{vlan.name}</p>
                <p className="mt-2 font-mono text-sm text-primary">
                  {vlan.cidr}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {vlan.purpose}
                </p>
              </div>
            ))}
          </div>
          <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
            {structure.recommendations.map((item) => (
              <li className="flex gap-2" key={item}>
                <Check className="shrink-0 text-primary" size={17} />
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function FloorPanel({
  title,
  subtitle,
  devices,
  connectionStates,
  tone,
  editable,
  onRemove,
  onAdd,
  onEditNodes,
  compact = false,
}: {
  title: string;
  subtitle: string;
  devices: Device[];
  connectionStates: Map<
    string,
    { local: boolean; uplink: boolean; shared: boolean }
  >;
  tone: "server" | "floor";
  editable: boolean;
  onRemove: (device: Device) => void;
  onAdd?: () => void;
  onEditNodes?: () => void;
  compact?: boolean;
}) {
  const endpointDevices = devices.filter((device) =>
    groupedEndpointCategories.has(device.data.category),
  );
  const visibleDevices = devices.filter(
    (device) => !groupedEndpointCategories.has(device.data.category),
  );
  const desktopCount = endpointDevices.filter(
    (device) => device.data.category === "DESKTOP_LAPTOP",
  ).length;
  const printerCount = endpointDevices.length - desktopCount;
  const connectedEndpointCount = endpointDevices.filter(
    (device) =>
      connectionStates.get(device.id)?.local ||
      connectionStates.get(device.id)?.uplink,
  ).length;
  return (
    <section
      className={`${compact ? "min-h-[290px]" : "min-h-[420px]"} rounded-2xl border p-4 ${tone === "server" ? "border-primary/40 bg-primary/5" : "bg-background/30"}`}
    >
      <div className="flex items-center gap-3 border-b pb-3">
        <span
          className={`grid h-10 w-10 place-items-center rounded-xl ${tone === "server" ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"}`}
        >
          {tone === "server" ? <Network size={19} /> : <Layers3 size={19} />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">{title}</h2>
          <p className="text-xs text-muted-foreground">
            {subtitle} · {devices.length} thiết bị
          </p>
        </div>
        {onAdd && editable && (
          <Button size="sm" variant="outline" onClick={onAdd}>
            <Plus size={15} />
            Thêm
          </Button>
        )}
      </div>
      <div
        className={`mt-3 grid ${compact ? "max-h-[260px]" : "max-h-[520px]"} gap-2 overflow-auto pr-1 sm:grid-cols-2`}
      >
        {endpointDevices.length > 0 && (
          <div className="rounded-lg border border-cyan-400/30 bg-cyan-400/5 p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-cyan-400/15 text-cyan-300">
                  <Monitor size={15} />
                </span>
                <div>
                  <p className="text-sm font-bold">User Nodes</p>
                  <p className="text-[10px] text-muted-foreground">
                    {desktopCount} Desktop/Laptop · {printerCount} Máy in
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-cyan-400/15 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300">
                {endpointDevices.length} node
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-muted-foreground">
              <span>
                {connectedEndpointCount}/{endpointDevices.length} đã kết nối
              </span>
              {editable && onEditNodes && (
                <button
                  className="rounded-md border border-cyan-400/30 px-1.5 py-0.5 font-bold text-cyan-300 hover:bg-cyan-400/10"
                  onClick={onEditNodes}
                >
                  <Plus className="inline" size={11} /> Cập nhật nodes
                </button>
              )}
            </div>
          </div>
        )}
        {visibleDevices.map((device) => {
          const state = connectionStates.get(device.id);
          const light = state?.shared
            ? "bg-amber-400"
            : state?.local && state.uplink
              ? "bg-gradient-to-r from-blue-400 to-emerald-400"
              : state?.local
                ? "bg-blue-400"
                : state?.uplink
                  ? "bg-emerald-400"
                  : "bg-slate-500";
          return (
            <div
              className="group rounded-lg border bg-background/70 p-2.5"
              key={device.id}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold">{device.data.hostname}</p>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                    {device.data.model}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${light}`} />
                  {editable && (
                    <button
                      aria-label={`Gỡ ${device.data.hostname}`}
                      className="text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100"
                      onClick={() => onRemove(device)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-[9px] text-muted-foreground">
                <span>{device.data.category.replaceAll("_", " ")}</span>
                <span>
                  {device.data.ports.filter((p) => !p.connected).length}/
                  {device.data.ports.length} port trống
                </span>
              </div>
            </div>
          );
        })}
        {!devices.length && (
          <p className="text-sm text-muted-foreground">
            Chưa có thiết bị được gán cho tầng này.
          </p>
        )}
      </div>
    </section>
  );
}

function OrganizationTopology({
  devices,
  links,
  activeFloorId,
  serverFloorId,
  floorLabel,
  scenarioId,
  locked,
  onPositionsSaved,
}: {
  devices: Device[];
  links: TopologyLink[];
  activeFloorId: string;
  serverFloorId: string;
  floorLabel: string;
  scenarioId: string;
  locked: boolean;
  onPositionsSaved: (
    positions: Array<{ id: string; graphX: number; graphY: number }>,
  ) => void;
}) {
  const activeDeviceIds = new Set(
    devices
      .filter((device) => device.data.floorId === activeFloorId)
      .map((device) => device.id),
  );
  const sharedNeighborIds = new Set(
    links.flatMap((link) => {
      if (activeDeviceIds.has(link.sourceDeviceId)) {
        const target = devices.find(
          (device) => device.id === link.targetDeviceId,
        );
        return target &&
          ![activeFloorId, serverFloorId].includes(target.data.floorId)
          ? [target.id]
          : [];
      }
      if (activeDeviceIds.has(link.targetDeviceId)) {
        const source = devices.find(
          (device) => device.id === link.sourceDeviceId,
        );
        return source &&
          ![activeFloorId, serverFloorId].includes(source.data.floorId)
          ? [source.id]
          : [];
      }
      return [];
    }),
  );
  const groupedEndpoints = devices.filter(
    (device) =>
      (device.data.floorId === activeFloorId ||
        sharedNeighborIds.has(device.id)) &&
      groupedEndpointCategories.has(device.data.category),
  );
  const endpointGroupsByFloor = new Map<string, Device[]>();
  for (const device of groupedEndpoints) {
    const group = endpointGroupsByFloor.get(device.data.floorId) ?? [];
    group.push(device);
    endpointGroupsByFloor.set(device.data.floorId, group);
  }
  const endpointGroupIdByDevice = new Map<string, string>();
  const endpointGroups = Array.from(endpointGroupsByFloor.entries()).map(
    ([floorId, group]) => {
      const groupId = `endpoint-group-${floorId}`;
      for (const device of group)
        endpointGroupIdByDevice.set(device.id, groupId);
      const desktopCount = group.filter(
        (device) => device.data.category === "DESKTOP_LAPTOP",
      ).length;
      const hasSavedPosition = group.some(
        (device) => device.graphX !== 0 || device.graphY !== 0,
      );
      return {
        id: groupId,
        graphX: hasSavedPosition
          ? group.reduce((sum, device) => sum + device.graphX, 0) / group.length
          : 0,
        graphY: hasSavedPosition
          ? group.reduce((sum, device) => sum + device.graphY, 0) / group.length
          : 0,
        data: {
          ...group[0].data,
          hostname:
            floorId === activeFloorId
              ? "USER NODES"
              : `USER NODES · ${group[0].data.floorCode}`,
          model: `${desktopCount} Desktop/Laptop · ${group.length - desktopCount} Máy in`,
          category: "ENDPOINT_GROUP",
          nodeCount: group.length,
          ports: [],
        },
      } satisfies Device;
    },
  );
  const groupedEndpointIds = new Set(endpointGroupIdByDevice.keys());
  const endpointGroupIds = new Set(endpointGroups.map((group) => group.id));
  const visibleDevices = [
    ...devices.filter(
      (device) =>
        ([activeFloorId, serverFloorId].includes(device.data.floorId) ||
          sharedNeighborIds.has(device.id)) &&
        !groupedEndpointIds.has(device.id),
    ),
    ...endpointGroups,
  ];
  const visibleIds = new Set(visibleDevices.map((device) => device.id));
  const groupedLinks = links
    .map((link) => ({
      ...link,
      sourceDeviceId:
        endpointGroupIdByDevice.get(link.sourceDeviceId) ?? link.sourceDeviceId,
      targetDeviceId:
        endpointGroupIdByDevice.get(link.targetDeviceId) ?? link.targetDeviceId,
    }))
    .filter(
      (link) =>
        link.sourceDeviceId !== link.targetDeviceId &&
        visibleIds.has(link.sourceDeviceId) &&
        visibleIds.has(link.targetDeviceId),
    );
  const visibleLinks = Array.from(
    new Map(
      groupedLinks.map((link) => {
        const pair = [link.sourceDeviceId, link.targetDeviceId]
          .sort()
          .join(":");
        return [pair, link];
      }),
    ).values(),
  );
  const adjacency = new Map(
    visibleDevices.map((device) => [device.id, new Set<string>()]),
  );
  for (const link of visibleLinks) {
    adjacency.get(link.sourceDeviceId)?.add(link.targetDeviceId);
    adjacency.get(link.targetDeviceId)?.add(link.sourceDeviceId);
  }
  const depth = new Map<string, number>();
  const serverDevices = visibleDevices.filter(
    (device) => device.data.floorId === serverFloorId,
  );
  const roots = serverDevices.filter(
    (device) => device.data.category === "CORE_SWITCH",
  );
  const queue = (roots.length ? roots : serverDevices).map((device) => {
    depth.set(device.id, 0);
    return device.id;
  });
  while (queue.length) {
    const id = queue.shift()!;
    for (const next of adjacency.get(id) ?? []) {
      if (!depth.has(next)) {
        depth.set(next, (depth.get(id) ?? 0) + 1);
        queue.push(next);
      }
    }
  }
  for (const device of visibleDevices) {
    if (!depth.has(device.id))
      depth.set(
        device.id,
        device.data.floorId === serverFloorId
          ? device.data.category === "CORE_SWITCH"
            ? 0
            : 1
          : ["ACCESS_SWITCH", "DISTRIBUTION_SWITCH"].includes(
                device.data.category,
              )
            ? 1
            : 3,
      );
  }
  const maxDepth = Math.max(3, ...depth.values());
  const rows = Array.from({ length: maxDepth + 1 }, (_, level) =>
    visibleDevices.filter((device) => depth.get(device.id) === level),
  );
  const height = Math.max(590, 150 + maxDepth * 145);
  const [ignoreSaved, setIgnoreSaved] = useState(false);
  const autoPositions = new Map<string, { x: number; y: number }>();
  for (const [level, row] of rows.entries())
    for (const [index, device] of row.entries())
      autoPositions.set(
        device.id,
        !ignoreSaved && (device.graphX !== 0 || device.graphY !== 0)
          ? {
              x: Math.max(90, Math.min(1010, device.graphX)),
              y: Math.max(20, Math.min(height - 90, device.graphY)),
            }
          : { x: ((index + 1) * 1100) / (row.length + 1), y: 45 + level * 145 },
      );
  const [manualPositions, setManualPositions] = useState<
    Map<string, { x: number; y: number }>
  >(new Map());
  const [drag, setDrag] = useState<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [savingLayout, setSavingLayout] = useState(false);
  const positions = new Map(autoPositions);
  for (const [id, position] of manualPositions) positions.set(id, position);
  function point(event: ReactPointerEvent<SVGForeignObjectElement>) {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return null;
    const bounds = svg.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * 1100,
      y: ((event.clientY - bounds.top) / bounds.height) * height,
    };
  }
  function startDrag(
    event: ReactPointerEvent<SVGForeignObjectElement>,
    id: string,
  ) {
    const cursor = point(event);
    const current = positions.get(id);
    if (!cursor || !current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      id,
      offsetX: cursor.x - current.x,
      offsetY: cursor.y - current.y,
    });
  }
  function moveDrag(event: ReactPointerEvent<SVGForeignObjectElement>) {
    if (!drag) return;
    const cursor = point(event);
    if (!cursor) return;
    setManualPositions((current) =>
      new Map(current).set(drag.id, {
        x: Math.max(90, Math.min(1010, cursor.x - drag.offsetX)),
        y: Math.max(20, Math.min(height - 90, cursor.y - drag.offsetY)),
      }),
    );
  }
  async function saveLayout() {
    setSavingLayout(true);
    setSaveMessage("");
    try {
      const persistedPositions = visibleDevices.flatMap((device) => {
        const position = positions.get(device.id)!;
        if (!endpointGroupIds.has(device.id))
          return [{ id: device.id, graphX: position.x, graphY: position.y }];
        return groupedEndpoints
          .filter(
            (endpoint) =>
              endpointGroupIdByDevice.get(endpoint.id) === device.id,
          )
          .map((endpoint) => ({
            id: endpoint.id,
            graphX: position.x,
            graphY: position.y,
          }));
      });
      await api(`/api/scenarios/${scenarioId}/topology`, {
        method: "PATCH",
        body: JSON.stringify({
          positions: persistedPositions,
        }),
      });
      onPositionsSaved(persistedPositions);
      setSaveMessage("Đã lưu");
      setIgnoreSaved(false);
    } catch (error) {
      setSaveMessage(
        error instanceof Error ? error.message : "Không thể lưu sơ đồ.",
      );
    } finally {
      setSavingLayout(false);
    }
  }
  return (
    <div className="h-full overflow-hidden rounded-2xl border bg-background/30">
      <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-bold">
            Organization Topology · B2 → {floorLabel}
          </h2>
          <p className="text-sm text-muted-foreground">
            Kéo thiết bị để sắp xếp; vector tự bám theo vị trí mới.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <i className="h-0.5 w-6 bg-emerald-400" />
            Uplink B2
          </span>
          <span className="flex items-center gap-2">
            <i className="h-0.5 w-6 bg-blue-400" />
            Local
          </span>
          <span className="flex items-center gap-2">
            <i className="h-0.5 w-6 bg-amber-400" />
            Shared tầng khác
          </span>
          <span className="flex items-center gap-2">
            <i className="h-0.5 w-6 bg-violet-400" />
            HA 2 chiều
          </span>
          <button
            className="inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 hover:bg-secondary"
            onClick={() => {
              setIgnoreSaved(true);
              setManualPositions(new Map());
              setSaveMessage("");
            }}
          >
            <RotateCcw size={13} />
            Reset
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-2 py-1.5 font-bold text-primary-foreground disabled:opacity-50"
            disabled={locked || savingLayout}
            onClick={saveLayout}
          >
            <Save size={13} />
            {savingLayout ? "Đang lưu" : "Lưu sơ đồ"}
          </button>
          {saveMessage && <span className="text-primary">{saveMessage}</span>}
        </div>
      </div>
      <div className="overflow-x-auto bg-[radial-gradient(circle_at_center,rgb(45_212_191/0.04),transparent_60%)]">
        <svg
          aria-label={`Sơ đồ kết nối B2 đến ${floorLabel}`}
          className="min-w-[900px] touch-none"
          role="img"
          viewBox={`0 0 1100 ${height}`}
        >
          <defs>
            <marker
              id="arrow-local"
              markerHeight="4"
              markerWidth="4"
              orient="auto"
              refX="3.5"
              refY="2"
            >
              <path d="M0,0 L4,2 L0,4 z" fill="#60a5fa" />
            </marker>
            <marker
              id="arrow-uplink"
              markerHeight="4"
              markerWidth="4"
              orient="auto"
              refX="3.5"
              refY="2"
            >
              <path d="M0,0 L4,2 L0,4 z" fill="#34d399" />
            </marker>
            <marker
              id="arrow-shared"
              markerHeight="4"
              markerWidth="4"
              orient="auto"
              refX="3.5"
              refY="2"
            >
              <path d="M0,0 L4,2 L0,4 z" fill="#fbbf24" />
            </marker>
            <marker
              id="arrow-ha"
              markerHeight="4"
              markerWidth="4"
              orient="auto-start-reverse"
              refX="3.5"
              refY="2"
            >
              <path d="M0,0 L4,2 L0,4 z" fill="#a78bfa" />
            </marker>
          </defs>
          {visibleLinks.map((link) => {
            const source = positions.get(link.sourceDeviceId);
            const target = positions.get(link.targetDeviceId);
            const a = visibleDevices.find(
              (device) => device.id === link.sourceDeviceId,
            );
            const b = visibleDevices.find(
              (device) => device.id === link.targetDeviceId,
            );
            if (!source || !target || !a || !b) return null;
            const ha =
              a.data.floorId === serverFloorId &&
              b.data.floorId === serverFloorId &&
              a.data.category === "CORE_SWITCH" &&
              b.data.category === "CORE_SWITCH";
            const local = a.data.floorId === b.data.floorId;
            const speed =
              link.speedMbps >= 1000
                ? `${link.speedMbps / 1000} Gbps`
                : `${link.speedMbps} Mbps`;
            if (ha) {
              const left = source.x <= target.x ? source : target;
              const right = source.x <= target.x ? target : source;
              const y = (left.y + right.y) / 2 + 29;
              const labelX = right.x - 126;
              return (
                <g key={link.id}>
                  <path
                    d={`M ${left.x + 74} ${y} C ${(left.x + right.x) / 2} ${y - 28}, ${(left.x + right.x) / 2} ${y - 28}, ${right.x - 74} ${y}`}
                    fill="none"
                    markerEnd="url(#arrow-ha)"
                    markerStart="url(#arrow-ha)"
                    stroke="#a78bfa"
                    strokeDasharray="8 5"
                    strokeWidth="3"
                  />
                  <rect
                    fill="#0f1d2a"
                    height="22"
                    rx="11"
                    stroke="#a78bfa"
                    strokeOpacity="0.65"
                    width="104"
                    x={labelX - 52}
                    y={y - 36}
                  />
                  <text
                    fill="#c4b5fd"
                    fontSize="11"
                    fontWeight="700"
                    textAnchor="middle"
                    x={labelX}
                    y={y - 21}
                  >
                    HA · {speed}
                  </text>
                </g>
              );
            }
            const start = source.y <= target.y ? source : target;
            const end = source.y <= target.y ? target : source;
            const shared =
              !local &&
              ![a.data.floorId, b.data.floorId].includes(serverFloorId);
            const color = local ? "#60a5fa" : shared ? "#fbbf24" : "#34d399";
            const midY = (start.y + end.y) / 2;
            // Keep the speed badge close to the destination arrow. The label
            // follows the same cubic Bezier, so it remains attached when a
            // user drags either device to a new position.
            const labelT = 0.82;
            const labelInverseT = 1 - labelT;
            const labelX =
              labelInverseT ** 3 * start.x +
              3 * labelInverseT ** 2 * labelT * start.x +
              3 * labelInverseT * labelT ** 2 * end.x +
              labelT ** 3 * end.x;
            const labelY =
              labelInverseT ** 3 * (start.y + 58) +
              3 * labelInverseT ** 2 * labelT * midY +
              3 * labelInverseT * labelT ** 2 * midY +
              labelT ** 3 * end.y -
              14;
            return (
              <g key={link.id}>
                <path
                  d={`M ${start.x} ${start.y + 58} C ${start.x} ${midY}, ${end.x} ${midY}, ${end.x} ${end.y}`}
                  fill="none"
                  markerEnd={`url(#${local ? "arrow-local" : shared ? "arrow-shared" : "arrow-uplink"})`}
                  stroke={color}
                  strokeWidth="3"
                />
                <rect
                  fill="#0f1d2a"
                  height="22"
                  rx="11"
                  stroke={color}
                  strokeOpacity="0.45"
                  width={shared ? 112 : 72}
                  x={labelX - (shared ? 56 : 36)}
                  y={labelY - 11}
                />
                <text
                  fill={color}
                  fontSize="11"
                  fontWeight="700"
                  textAnchor="middle"
                  x={labelX}
                  y={labelY + 4}
                >
                  {shared ? `SHARED · ${speed}` : speed}
                </text>
              </g>
            );
          })}
          {visibleDevices.map((device) => {
            const position = positions.get(device.id)!;
            const level = depth.get(device.id) ?? 0;
            const connected = (adjacency.get(device.id)?.size ?? 0) > 0;
            const isEndpointGroup = endpointGroupIds.has(device.id);
            return (
              <foreignObject
                className="cursor-move"
                height="61"
                key={device.id}
                onPointerDown={(event) => startDrag(event, device.id)}
                onPointerMove={moveDrag}
                onPointerUp={() => setDrag(null)}
                width="136"
                x={position.x - 68}
                y={position.y}
              >
                <div
                  className={`relative h-[58px] select-none rounded-lg border-2 bg-[#0b1722] px-2.5 py-1.5 shadow-xl ${connected ? (level === 0 ? "border-emerald-400/70" : "border-blue-400/70") : "border-slate-600"}`}
                >
                  <Move
                    className="absolute bottom-1.5 right-1.5 text-slate-600"
                    size={10}
                  />
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      {isEndpointGroup && (
                        <Monitor className="text-cyan-300" size={11} />
                      )}
                      <b className="max-w-[105px] truncate text-[11px] text-white">
                        {device.data.hostname}
                      </b>
                    </span>
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${connected ? (level === 0 ? "bg-emerald-400" : "bg-blue-400") : "bg-slate-500"}`}
                    />
                  </div>
                  <p className="mt-0.5 max-w-[112px] truncate text-[8px] text-slate-400">
                    {device.data.model}
                  </p>
                  <p className="mt-0.5 text-[7px] font-bold uppercase tracking-wide text-slate-500">
                    {isEndpointGroup
                      ? `${String(device.data.nodeCount ?? 0)} NODE`
                      : level === 0
                        ? "B2 · Server Room"
                        : `${device.data.floorCode} · ${device.data.category.replaceAll("_", " ")}`}
                  </p>
                </div>
              </foreignObject>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
