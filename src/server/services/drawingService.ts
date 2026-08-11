import { z } from "zod";

import {
  DrawingDocumentType,
  DrawingStatus,
  type Prisma,
} from "@/generated/prisma/client";
import { AppError } from "@/server/errors";
import {
  PrismaDrawingRepository,
  type DrawingFilters,
  type DrawingRepository,
} from "@/server/repositories/drawingRepository";

const metadataSchema = z.record(z.string(), z.json()).optional();

export const createDrawingDocumentSchema = z.object({
  campusId: z.string().min(1),
  buildingId: z.string().min(1),
  name: z.string().trim().min(2).max(200),
  documentType: z.enum(DrawingDocumentType),
  metadataJson: metadataSchema,
  uploadedBy: z.string().trim().min(1).max(120),
});

export const updateDrawingDocumentSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    documentType: z.enum(DrawingDocumentType).optional(),
    metadataJson: metadataSchema,
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required.",
  );

export async function listDrawingDocuments(
  filters: DrawingFilters,
  repository: DrawingRepository = new PrismaDrawingRepository(),
) {
  return repository.list({
    ...filters,
    search: filters.search?.trim() || undefined,
  });
}

export async function getDrawingDocument(
  id: string,
  repository: DrawingRepository = new PrismaDrawingRepository(),
) {
  const drawing = await repository.findById(id);
  if (!drawing) {
    throw new AppError(
      "DRAWING_NOT_FOUND",
      "Drawing document was not found.",
      404,
    );
  }
  return drawing;
}

export async function createDrawingDocument(
  input: unknown,
  repository: DrawingRepository = new PrismaDrawingRepository(),
) {
  const parsed = createDrawingDocumentSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(
      "INVALID_DRAWING",
      parsed.error.issues[0]?.message ?? "Invalid drawing document.",
      400,
    );
  }
  if (
    !(await repository.locationExists(
      parsed.data.campusId,
      parsed.data.buildingId,
    ))
  ) {
    throw new AppError(
      "INVALID_DRAWING_LOCATION",
      "Building must belong to the selected campus.",
      400,
    );
  }

  const { campusId, buildingId, metadataJson, ...data } = parsed.data;
  return repository.create({
    ...data,
    metadataJson: metadataJson as Prisma.InputJsonValue | undefined,
    campus: { connect: { id: campusId } },
    building: { connect: { id_campusId: { id: buildingId, campusId } } },
  });
}

export async function updateDrawingDocument(
  id: string,
  input: unknown,
  repository: DrawingRepository = new PrismaDrawingRepository(),
) {
  await getDrawingDocument(id, repository);
  const parsed = updateDrawingDocumentSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(
      "INVALID_DRAWING",
      parsed.error.issues[0]?.message ?? "Invalid drawing document.",
      400,
    );
  }
  return repository.update(id, {
    ...parsed.data,
    metadataJson: parsed.data.metadataJson as Prisma.InputJsonValue | undefined,
  });
}

export async function deleteDrawingDocument(
  id: string,
  repository: DrawingRepository = new PrismaDrawingRepository(),
) {
  const drawing = await getDrawingDocument(id, repository);
  const references = Object.values(drawing._count).reduce(
    (sum, count) => sum + count,
    0,
  );
  if (references > 0) {
    throw new AppError(
      "DRAWING_IN_USE",
      "A drawing with revisions or derived records requires the retention workflow.",
      409,
    );
  }
  await repository.delete(id);
}

export function parseDrawingFilters(
  values: Record<string, string | undefined>,
): DrawingFilters {
  const documentType = z
    .enum(DrawingDocumentType)
    .safeParse(values.documentType);
  const status = z.enum(DrawingStatus).safeParse(values.status);
  return {
    campusId: values.campusId || undefined,
    buildingId: values.buildingId || undefined,
    documentType: documentType.success ? documentType.data : undefined,
    status: status.success ? status.data : undefined,
    search: values.search || undefined,
  };
}
