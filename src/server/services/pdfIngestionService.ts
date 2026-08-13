import { randomUUID } from "node:crypto";

import { z } from "zod";

import { AppError } from "@/server/errors";
import {
  PrismaPdfIngestionRepository,
  type PdfIngestionRepository,
} from "@/server/repositories/pdfIngestionRepository";
import { getObjectStorage } from "@/server/storage";
import {
  createDrawingObjectKey,
  type ObjectStorage,
} from "@/server/storage/objectStorage";

export const MAX_PDF_BYTES = 50 * 1024 * 1024;

const uploadSchema = z.object({
  revisionCode: z.string().trim().min(1).max(40),
});

const mappingSchema = z.object({
  buildingId: z.string().min(1),
  floorId: z.string().min(1),
});

async function* fileChunks(file: File) {
  const reader = file.stream().getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

export async function uploadPdfRevision(
  documentId: string,
  revisionCode: unknown,
  file: unknown,
  repository: PdfIngestionRepository = new PrismaPdfIngestionRepository(),
  storage: ObjectStorage = getObjectStorage(),
) {
  const parsed = uploadSchema.safeParse({ revisionCode });
  if (!parsed.success)
    throw new AppError("INVALID_REVISION", "Revision code is required.", 400);
  if (!(file instanceof File))
    throw new AppError("PDF_REQUIRED", "A PDF file is required.", 400);
  if (file.size === 0 || file.size > MAX_PDF_BYTES)
    throw new AppError(
      "PDF_SIZE_INVALID",
      `PDF must be between 1 byte and ${MAX_PDF_BYTES} bytes.`,
      413,
    );
  if (file.type && file.type !== "application/pdf")
    throw new AppError(
      "PDF_MIME_INVALID",
      "Only application/pdf is accepted.",
      415,
    );
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (new TextDecoder().decode(header) !== "%PDF-")
    throw new AppError(
      "PDF_SIGNATURE_INVALID",
      "File is not a valid PDF.",
      415,
    );

  const context = await repository.findUploadContext(documentId);
  if (!context)
    throw new AppError(
      "DRAWING_NOT_FOUND",
      "Drawing document was not found.",
      404,
    );
  if (await repository.revisionCodeExists(documentId, parsed.data.revisionCode))
    throw new AppError(
      "REVISION_EXISTS",
      "Revision code already exists for this drawing.",
      409,
    );

  const revisionId = randomUUID();
  const storageKey = createDrawingObjectKey({
    campusId: context.campusId,
    documentId,
    revisionId,
    extension: "pdf",
  });
  const stored = await storage.put({
    key: storageKey,
    contentType: "application/pdf",
    body: fileChunks(file),
    maxBytes: MAX_PDF_BYTES,
  });
  try {
    await repository.createUploadedRevision({
      documentId,
      revisionId,
      revisionCode: parsed.data.revisionCode,
      originalFileName: file.name.slice(0, 255),
      fileSize: stored.size,
      checksumSha256: stored.checksumSha256,
      storageKey,
    });
  } catch (error) {
    await storage.delete(storageKey).catch(() => undefined);
    throw error;
  }
  return { revisionId, jobStatus: "QUEUED" as const };
}

export async function getPdfDrawingDetail(
  documentId: string,
  repository: PdfIngestionRepository = new PrismaPdfIngestionRepository(),
) {
  const drawing = await repository.getDocumentDetail(documentId);
  if (!drawing)
    throw new AppError(
      "DRAWING_NOT_FOUND",
      "Drawing document was not found.",
      404,
    );
  return drawing;
}

export async function listDrawingUploadOptions(
  repository: PdfIngestionRepository = new PrismaPdfIngestionRepository(),
) {
  return repository.listUploadOptions();
}

export async function mapDrawingPage(
  pageId: string,
  input: unknown,
  repository: PdfIngestionRepository = new PrismaPdfIngestionRepository(),
) {
  const parsed = mappingSchema.safeParse(input);
  if (!parsed.success)
    throw new AppError(
      "INVALID_PAGE_MAPPING",
      "Building and floor are required.",
      400,
    );
  const page = await repository.findPage(pageId);
  if (!page)
    throw new AppError(
      "DRAWING_PAGE_NOT_FOUND",
      "Drawing page was not found.",
      404,
    );
  if (page.buildingId !== parsed.data.buildingId)
    throw new AppError(
      "INVALID_PAGE_MAPPING",
      "Page can only be mapped inside its drawing building.",
      400,
    );
  if (
    !(await repository.floorBelongsToBuilding(
      parsed.data.buildingId,
      parsed.data.floorId,
    ))
  )
    throw new AppError(
      "INVALID_PAGE_MAPPING",
      "Floor must belong to the drawing building.",
      400,
    );
  await repository.mapPageToFloor(
    pageId,
    parsed.data.buildingId,
    parsed.data.floorId,
  );
  return { mapped: true };
}

export async function getDrawingPageAsset(
  pageId: string,
  variant: "preview" | "thumbnail",
  repository: PdfIngestionRepository = new PrismaPdfIngestionRepository(),
  storage: ObjectStorage = getObjectStorage(),
) {
  const page = await repository.findPage(pageId);
  if (!page)
    throw new AppError(
      "DRAWING_PAGE_NOT_FOUND",
      "Drawing page was not found.",
      404,
    );
  const key =
    variant === "thumbnail" ? page.thumbnailStorageKey : page.previewStorageKey;
  if (!key)
    throw new AppError("PREVIEW_NOT_READY", "Page preview is not ready.", 404);
  const metadata = await storage.inspect(key);
  if (!metadata)
    throw new AppError(
      "PREVIEW_NOT_FOUND",
      "Stored preview was not found.",
      404,
    );
  return { metadata, body: await storage.openRead(key) };
}
