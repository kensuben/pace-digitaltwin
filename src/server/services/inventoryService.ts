import { z } from "zod";

import { generatePorts } from "@/domain/ports/generatePorts";
import { DeviceCategory, DeviceStatus } from "@/generated/prisma/enums";
import { AppError } from "@/server/errors";
import {
  PrismaInventoryRepository,
  type CreateDeviceRecord,
  type InventoryFilters,
  type InventoryRepository,
} from "@/server/repositories/inventoryRepository";

const nullableTrimmed = z.string().trim().max(500).optional().nullable();

export const createDeviceSchema = z.object({
  scenarioId: z.string().min(1),
  hostname: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
    .transform((value) => value.toUpperCase()),
  displayName: z.string().trim().min(2).max(160),
  assetTag: z.string().trim().max(80).optional().nullable(),
  modelId: z.string().min(1),
  serialNumber: z.string().trim().max(120).optional().nullable(),
  managementIp: z.string().trim().max(64).optional().nullable(),
  buildingId: z.string().min(1),
  floorId: z.string().min(1),
  zoneId: z.string().min(1).optional().nullable(),
  rackId: z.string().min(1).optional().nullable(),
  rackUnitStart: z.number().int().positive().optional().nullable(),
  notes: nullableTrimmed,
});

export const updateDeviceSchema = z
  .object({
    hostname: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
      .transform((value) => value.toUpperCase())
      .optional(),
    displayName: z.string().trim().min(2).max(160).optional(),
    assetTag: z.string().trim().max(80).optional().nullable(),
    serialNumber: z.string().trim().max(120).optional().nullable(),
    managementIp: z.string().trim().max(64).optional().nullable(),
    status: z.enum(DeviceStatus).optional(),
    buildingId: z.string().min(1).optional(),
    floorId: z.string().min(1).optional(),
    zoneId: z.string().min(1).optional().nullable(),
    rackId: z.string().min(1).optional().nullable(),
    rackUnitStart: z.number().int().positive().optional().nullable(),
    notes: nullableTrimmed,
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required.",
  );

export async function listInventory(
  filters: InventoryFilters,
  repository: InventoryRepository = new PrismaInventoryRepository(),
) {
  return repository.list({
    ...filters,
    search: filters.search?.trim() || undefined,
  });
}

export async function getInventoryDevice(
  scenarioId: string,
  id: string,
  repository: InventoryRepository = new PrismaInventoryRepository(),
) {
  if (!scenarioId)
    throw new AppError("SCENARIO_REQUIRED", "scenarioId is required.", 400);
  const device = await repository.findByIdInScenario(id, scenarioId);
  if (!device)
    throw new AppError(
      "DEVICE_NOT_FOUND",
      "Device was not found in this scenario.",
      404,
    );
  return device;
}

export async function createInventoryDevice(
  input: unknown,
  repository: InventoryRepository = new PrismaInventoryRepository(),
) {
  const parsed = createDeviceSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(
      "INVALID_DEVICE",
      parsed.error.issues[0]?.message ?? "Invalid device.",
      400,
    );
  }
  const record: CreateDeviceRecord = parsed.data;
  const context = await repository.getCreationContext(record);
  if (!context.scenario)
    throw new AppError("SCENARIO_NOT_FOUND", "Scenario was not found.", 404);
  if (context.scenario.isLocked) {
    throw new AppError(
      "SCENARIO_LOCKED",
      "Locked scenarios cannot be changed.",
      409,
    );
  }
  if (!context.profiles)
    throw new AppError("MODEL_NOT_FOUND", "Device model was not found.", 404);
  if (!context.locationValid) {
    throw new AppError(
      "INVALID_LOCATION",
      "Building, floor, zone and rack must form one hierarchy.",
      400,
    );
  }
  return repository.createWithPorts(record, generatePorts(context.profiles));
}

async function assertScenarioMutable(
  scenarioId: string,
  deviceId: string,
  repository: InventoryRepository,
  allowLockedIdentityEdit = false,
) {
  const device = await getInventoryDevice(scenarioId, deviceId, repository);
  if (device.scenario.isLocked && !allowLockedIdentityEdit) {
    throw new AppError(
      "SCENARIO_LOCKED",
      "Locked scenarios cannot be changed.",
      409,
    );
  }
  return device;
}

export async function updateInventoryDevice(
  scenarioId: string,
  deviceId: string,
  input: unknown,
  repository: InventoryRepository = new PrismaInventoryRepository(),
) {
  const parsed = updateDeviceSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(
      "INVALID_DEVICE",
      parsed.error.issues[0]?.message ?? "Invalid device.",
      400,
    );
  }
  const fields = Object.keys(parsed.data);
  const identityOnly =
    fields.length > 0 &&
    fields.every((field) => field === "hostname" || field === "displayName");
  const current = await assertScenarioMutable(
    scenarioId,
    deviceId,
    repository,
    identityOnly,
  );
  const locationFields = ["buildingId", "floorId", "zoneId", "rackId"];
  const changesLocation = fields.some((field) =>
    locationFields.includes(field),
  );
  if (changesLocation) {
    if (!parsed.data.buildingId || !parsed.data.floorId)
      throw new AppError(
        "INVALID_LOCATION",
        "buildingId and floorId are required when changing location.",
        400,
      );
    const context = await repository.getCreationContext({
      scenarioId,
      hostname: current.hostname,
      displayName: current.displayName,
      modelId: current.modelId,
      buildingId: parsed.data.buildingId,
      floorId: parsed.data.floorId,
      zoneId: parsed.data.zoneId ?? null,
      rackId: parsed.data.rackId ?? null,
    });
    if (!context.locationValid)
      throw new AppError(
        "INVALID_LOCATION",
        "Building, floor, zone and rack must form one hierarchy.",
        400,
      );
  }
  if (parsed.data.hostname && repository.findHostnameConflict) {
    const conflict = await repository.findHostnameConflict(
      scenarioId,
      parsed.data.hostname,
      deviceId,
    );
    if (conflict)
      throw new AppError(
        "HOSTNAME_CONFLICT",
        "Hostname already exists in this scenario.",
        409,
      );
  }
  const updated = await repository.updateInScenario(
    deviceId,
    scenarioId,
    parsed.data,
  );
  if (!updated)
    throw new AppError(
      "DEVICE_NOT_FOUND",
      "Device was not found in this scenario.",
      404,
    );
  return updated;
}

export async function deleteInventoryDevice(
  scenarioId: string,
  deviceId: string,
  repository: InventoryRepository = new PrismaInventoryRepository(),
) {
  await assertScenarioMutable(scenarioId, deviceId, repository);
  const deleted = await repository.deleteInScenario(deviceId, scenarioId);
  if (!deleted)
    throw new AppError(
      "DEVICE_NOT_FOUND",
      "Device was not found in this scenario.",
      404,
    );
}

export async function getInventoryOptions(
  repository: InventoryRepository = new PrismaInventoryRepository(),
) {
  return repository.listOptions();
}

export function parseInventoryFilters(
  values: Record<string, string | undefined>,
): InventoryFilters {
  const category = z.enum(DeviceCategory).safeParse(values.category);
  const status = z.enum(DeviceStatus).safeParse(values.status);
  return {
    scenarioId: values.scenarioId || undefined,
    search: values.search || undefined,
    category: category.success ? category.data : undefined,
    status: status.success ? status.data : undefined,
  };
}
