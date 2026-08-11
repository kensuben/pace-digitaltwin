import { z } from "zod";

import { generatePorts } from "@/domain/ports/generatePorts";
import {
  DeviceCategory,
  PortMedia,
  PortRoleHint,
  PoeStandard,
} from "@/generated/prisma/enums";
import { AppError } from "@/server/errors";
import {
  PrismaCatalogRepository,
  type CatalogFilters,
  type CatalogRepository,
} from "@/server/repositories/catalogRepository";

const optionalPositiveNumber = z.number().positive().optional().nullable();
const profileSchema = z.object({
  portGroup: z.string().trim().min(1).max(80),
  count: z.number().int().positive().max(512),
  media: z.enum(PortMedia),
  supportedSpeedsMbps: z.array(z.number().int().positive()).min(1),
  poeStandard: z.enum(PoeStandard).default("NONE"),
  roleHint: z.enum(PortRoleHint).default("DATA"),
  breakoutCapable: z.boolean().default(false),
  namePrefix: z.string().min(1).max(80),
  startNumber: z.number().int().nonnegative().default(1),
  sortOrder: z.number().int().nonnegative().default(0),
});

export const createCatalogModelSchema = z.object({
  vendorId: z.string().min(1),
  category: z.enum(DeviceCategory),
  sku: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .transform((value) => value.toUpperCase()),
  modelName: z.string().trim().min(2).max(160),
  formFactor: z.string().trim().max(40).optional().nullable(),
  rackUnits: z.number().int().positive().optional().nullable(),
  switchingCapacityGbps: optionalPositiveNumber,
  firewallGbps: optionalPositiveNumber,
  ipsGbps: optionalPositiveNumber,
  ngfwGbps: optionalPositiveNumber,
  tlsInspectionGbps: optionalPositiveNumber,
  supportsLacp: z.boolean().default(false),
  supportsMlag: z.boolean().default(false),
  supportsStacking: z.boolean().default(false),
  supportsHa: z.boolean().default(false),
  managementOs: z.string().trim().max(100).optional().nullable(),
  sourceUrl: z.url().optional().nullable(),
  portProfiles: z.array(profileSchema).min(1),
});

export const updateCatalogModelSchema = createCatalogModelSchema
  .omit({ vendorId: true, sku: true })
  .partial();

export async function listCatalog(
  filters: CatalogFilters,
  repository: CatalogRepository = new PrismaCatalogRepository(),
) {
  return repository.list({
    ...filters,
    search: filters.search?.trim() || undefined,
  });
}

export async function getCatalogModel(
  id: string,
  repository: CatalogRepository = new PrismaCatalogRepository(),
) {
  const model = await repository.findById(id);
  if (!model)
    throw new AppError("MODEL_NOT_FOUND", "Device model was not found.", 404);
  return model;
}

export async function createCatalogModel(
  input: unknown,
  repository: CatalogRepository = new PrismaCatalogRepository(),
) {
  const parsed = createCatalogModelSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(
      "INVALID_MODEL",
      parsed.error.issues[0]?.message ?? "Invalid model.",
      400,
    );
  }
  generatePorts(parsed.data.portProfiles);

  const { portProfiles, vendorId, ...model } = parsed.data;
  return repository.create({
    ...model,
    specStatus: "USER_CONFIRMED",
    isCustom: true,
    vendor: { connect: { id: vendorId } },
    portProfiles: { create: portProfiles },
  });
}

export async function updateCatalogModel(
  id: string,
  input: unknown,
  repository: CatalogRepository = new PrismaCatalogRepository(),
) {
  const current = await getCatalogModel(id, repository);
  if (!current.isCustom) {
    throw new AppError(
      "VENDOR_MODEL_READ_ONLY",
      "Verified vendor models are read-only.",
      409,
    );
  }
  const parsed = updateCatalogModelSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(
      "INVALID_MODEL",
      parsed.error.issues[0]?.message ?? "Invalid model.",
      400,
    );
  }
  if (parsed.data.portProfiles) generatePorts(parsed.data.portProfiles);

  const { portProfiles, ...model } = parsed.data;
  return repository.update(id, {
    ...model,
    specStatus: "USER_CONFIRMED",
    portProfiles: portProfiles
      ? { deleteMany: {}, create: portProfiles }
      : undefined,
  });
}

export async function deleteCatalogModel(
  id: string,
  repository: CatalogRepository = new PrismaCatalogRepository(),
) {
  const current = await getCatalogModel(id, repository);
  if (!current.isCustom) {
    throw new AppError(
      "VENDOR_MODEL_READ_ONLY",
      "Verified vendor models are read-only.",
      409,
    );
  }
  if (current._count.instances > 0) {
    throw new AppError(
      "MODEL_IN_USE",
      "A model used by inventory cannot be deleted.",
      409,
    );
  }
  await repository.delete(id);
}
