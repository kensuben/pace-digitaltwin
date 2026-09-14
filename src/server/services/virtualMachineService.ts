import { z } from "zod";

import { VirtualMachineStatus } from "@/generated/prisma/enums";
import { AppError } from "@/server/errors";
import { PrismaVirtualMachineRepository, type VirtualMachineRepository } from "@/server/repositories/virtualMachineRepository";

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();
const createVirtualMachineSchema = z.object({
  hostname: z.string().trim().min(2).max(80).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/).transform((value) => value.toUpperCase()),
  displayName: z.string().trim().min(2).max(160),
  role: optionalText(120),
  operatingSystem: optionalText(120),
  vcpuCount: z.number().int().min(1).max(1024),
  memoryMb: z.number().int().min(128).max(16_777_216),
  storageGb: z.number().int().min(1).max(10_000_000),
  ipAddress: z.string().trim().max(64).optional().nullable(),
  status: z.enum(VirtualMachineStatus).default("PLANNED"),
  notes: optionalText(1000),
});
const updateVirtualMachineSchema = createVirtualMachineSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required.",
);

async function assertMutableServer(scenarioId: string, hostDeviceId: string, repository: VirtualMachineRepository) {
  const context = await repository.getHostContext(scenarioId, hostDeviceId);
  if (!context.scenario) throw new AppError("SCENARIO_NOT_FOUND", "Scenario was not found.", 404);
  if (context.scenario.isLocked) throw new AppError("SCENARIO_LOCKED", "Locked scenarios cannot be changed.", 409);
  if (!context.host) throw new AppError("SERVER_NOT_FOUND", "Physical server was not found in this scenario.", 404);
  if (context.host.model.category !== "SERVER") throw new AppError("INVALID_VM_HOST", "Virtual machines can only be assigned to physical SERVER devices.", 409);
}

export async function createVirtualMachine(
  scenarioId: string,
  hostDeviceId: string,
  input: unknown,
  repository: VirtualMachineRepository = new PrismaVirtualMachineRepository(),
) {
  const parsed = createVirtualMachineSchema.safeParse(input);
  if (!parsed.success) throw new AppError("INVALID_VIRTUAL_MACHINE", parsed.error.issues[0]?.message ?? "Invalid virtual machine.", 400);
  await assertMutableServer(scenarioId, hostDeviceId, repository);
  if (await repository.findHostnameConflict(scenarioId, parsed.data.hostname))
    throw new AppError("VM_HOSTNAME_CONFLICT", "VM hostname already exists in this scenario.", 409);
  return repository.create({ scenarioId, hostDeviceId, ...parsed.data });
}

export async function updateVirtualMachine(
  scenarioId: string,
  hostDeviceId: string,
  vmId: string,
  input: unknown,
  repository: VirtualMachineRepository = new PrismaVirtualMachineRepository(),
) {
  const parsed = updateVirtualMachineSchema.safeParse(input);
  if (!parsed.success) throw new AppError("INVALID_VIRTUAL_MACHINE", parsed.error.issues[0]?.message ?? "Invalid virtual machine.", 400);
  await assertMutableServer(scenarioId, hostDeviceId, repository);
  if (!(await repository.findById(vmId, scenarioId, hostDeviceId))) throw new AppError("VIRTUAL_MACHINE_NOT_FOUND", "Virtual machine was not found on this server.", 404);
  if (parsed.data.hostname && await repository.findHostnameConflict(scenarioId, parsed.data.hostname, vmId))
    throw new AppError("VM_HOSTNAME_CONFLICT", "VM hostname already exists in this scenario.", 409);
  await repository.update(vmId, scenarioId, hostDeviceId, parsed.data);
  return { id: vmId, ...parsed.data };
}

export async function deleteVirtualMachine(
  scenarioId: string,
  hostDeviceId: string,
  vmId: string,
  repository: VirtualMachineRepository = new PrismaVirtualMachineRepository(),
) {
  await assertMutableServer(scenarioId, hostDeviceId, repository);
  if (!(await repository.delete(vmId, scenarioId, hostDeviceId))) throw new AppError("VIRTUAL_MACHINE_NOT_FOUND", "Virtual machine was not found on this server.", 404);
}
