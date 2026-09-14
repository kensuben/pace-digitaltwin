import { describe, expect, it, vi } from "vitest";

import type { VirtualMachineRepository } from "@/server/repositories/virtualMachineRepository";
import { createVirtualMachine, deleteVirtualMachine, updateVirtualMachine } from "@/server/services/virtualMachineService";

function repository(overrides: Partial<VirtualMachineRepository> = {}) {
  return {
    getHostContext: vi.fn().mockResolvedValue({ scenario: { isLocked: false }, host: { id: "server-1", model: { category: "SERVER" } } }),
    findById: vi.fn().mockResolvedValue({ id: "vm-1", hostname: "APP-01" }),
    findHostnameConflict: vi.fn().mockResolvedValue(false),
    create: vi.fn().mockImplementation(async (data) => ({ id: "vm-1", ...data })),
    update: vi.fn().mockResolvedValue(true),
    delete: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as VirtualMachineRepository;
}

const validInput = {
  hostname: " app-01 ", displayName: "Application Server", role: "Application",
  operatingSystem: "Ubuntu 24.04", vcpuCount: 4, memoryMb: 8192,
  storageGb: 100, ipAddress: "10.181.20.11", status: "RUNNING",
};

describe("virtualMachineService", () => {
  it("creates a normalized VM on a physical server", async () => {
    const repo = repository();
    await createVirtualMachine("scenario-1", "server-1", validInput, repo);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ scenarioId: "scenario-1", hostDeviceId: "server-1", hostname: "APP-01", vcpuCount: 4 }));
  });

  it("rejects non-server hosts and locked scenarios", async () => {
    await expect(createVirtualMachine("scenario-1", "switch-1", validInput, repository({ getHostContext: vi.fn().mockResolvedValue({ scenario: { isLocked: false }, host: { id: "switch-1", model: { category: "CORE_SWITCH" } } }) }))).rejects.toMatchObject({ code: "INVALID_VM_HOST" });
    await expect(createVirtualMachine("scenario-1", "server-1", validInput, repository({ getHostContext: vi.fn().mockResolvedValue({ scenario: { isLocked: true }, host: { id: "server-1", model: { category: "SERVER" } } }) }))).rejects.toMatchObject({ code: "SCENARIO_LOCKED" });
  });

  it("rejects invalid resources and duplicate hostnames", async () => {
    await expect(createVirtualMachine("scenario-1", "server-1", { ...validInput, memoryMb: 0 }, repository())).rejects.toMatchObject({ code: "INVALID_VIRTUAL_MACHINE" });
    await expect(createVirtualMachine("scenario-1", "server-1", validInput, repository({ findHostnameConflict: vi.fn().mockResolvedValue(true) }))).rejects.toMatchObject({ code: "VM_HOSTNAME_CONFLICT" });
  });

  it("updates an existing VM within its host scope", async () => {
    const repo = repository();
    await updateVirtualMachine("scenario-1", "server-1", "vm-1", { status: "STOPPED", memoryMb: 16384 }, repo);
    expect(repo.update).toHaveBeenCalledWith("vm-1", "scenario-1", "server-1", { status: "STOPPED", memoryMb: 16384 });
  });

  it("does not update or delete a VM from another host", async () => {
    const missing = repository({ findById: vi.fn().mockResolvedValue(null), delete: vi.fn().mockResolvedValue(false) });
    await expect(updateVirtualMachine("scenario-1", "server-1", "missing", { status: "RUNNING" }, missing)).rejects.toMatchObject({ code: "VIRTUAL_MACHINE_NOT_FOUND" });
    await expect(deleteVirtualMachine("scenario-1", "server-1", "missing", missing)).rejects.toMatchObject({ code: "VIRTUAL_MACHINE_NOT_FOUND" });
  });
});
