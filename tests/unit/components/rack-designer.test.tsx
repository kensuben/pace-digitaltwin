/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RackDesigner } from "@/components/racks/rack-designer";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const device = { id: "fw", hostname: "FW-01", displayName: "Firewall", category: "FIREWALL", sku: "FW", modelName: "Firewall model", vendorName: "Vendor", rackUnits: 1, rackId: "rack", rackUnitStart: 3, virtualMachines: [] };
const detail = { ...device, status: "ACTIVE", managementIp: "10.0.0.1", model: { vendor: { name: "Vendor" }, modelName: "Firewall model", sku: "FW", category: "FIREWALL", rackUnits: 1 }, ports: [] };

it("opens device configuration in locked racks without allowing placement", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: detail }) });
  vi.stubGlobal("fetch", fetchMock);
  render(<RackDesigner scenarioId="locked" isLocked racks={[{ id: "rack", code: "R01", name: "Rack", rackUnits: 4, devices: [device] }]} unplacedDevices={[]}/>);
  fireEvent.click(screen.getByRole("button", { name: "Xem thông tin FW-01" }));
  expect(await screen.findByText("10.0.0.1")).toBeVisible();
  expect(fetchMock).toHaveBeenCalledWith("/api/inventory/fw?scenarioId=locked", expect.objectContaining({ signal: expect.any(AbortSignal) }));
  expect(screen.getByRole("button", { name: "Đặt thiết bị tại U4" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Đóng thông tin thiết bị" }));
  expect(screen.queryByText("10.0.0.1")).not.toBeInTheDocument();
});

it("allows viewing unplaced devices and retrying a failed detail request", async () => {
  const fetchMock = vi.fn().mockRejectedValueOnce(new Error("Mất kết nối")).mockResolvedValue({ ok: true, json: async () => ({ data: detail }) });
  vi.stubGlobal("fetch", fetchMock);
  render(<RackDesigner scenarioId="locked" isLocked racks={[]} unplacedDevices={[{ ...device, rackId: null, rackUnitStart: null }]}/>);
  fireEvent.click(screen.getByRole("button", { name: /FW-01/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Mất kết nối");
  fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
  expect(await screen.findByText("10.0.0.1")).toBeVisible();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
