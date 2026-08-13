import { describe, expect, it, vi } from "vitest";

import type { PdfIngestionRepository } from "@/server/repositories/pdfIngestionRepository";
import type { ObjectStorage } from "@/server/storage/objectStorage";
import {
  mapDrawingPage,
  uploadPdfRevision,
} from "@/server/services/pdfIngestionService";

function repository(overrides: Partial<PdfIngestionRepository> = {}) {
  return {
    findUploadContext: vi.fn().mockResolvedValue({
      id: "drawing-1",
      campusId: "campus-1",
      buildingId: "building-1",
    }),
    revisionCodeExists: vi.fn().mockResolvedValue(false),
    createUploadedRevision: vi.fn().mockResolvedValue({ id: "revision-1" }),
    claimNextJob: vi.fn().mockResolvedValue(null),
    completeJob: vi.fn().mockResolvedValue(undefined),
    failJob: vi.fn().mockResolvedValue(undefined),
    findPage: vi.fn().mockResolvedValue({
      id: "page-1",
      drawingDocumentId: "drawing-1",
      buildingId: "building-1",
      previewStorageKey: "preview.webp",
      thumbnailStorageKey: "thumbnail.webp",
    }),
    mapPageToFloor: vi.fn().mockResolvedValue(undefined),
    floorBelongsToBuilding: vi.fn().mockResolvedValue(true),
    getDocumentDetail: vi.fn().mockResolvedValue({ id: "drawing-1" }),
    listUploadOptions: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as PdfIngestionRepository;
}

function storage(overrides: Partial<ObjectStorage> = {}) {
  return {
    put: vi.fn().mockImplementation(async (input) => {
      let size = 0;
      for await (const chunk of input.body) size += chunk.byteLength;
      return {
        key: input.key,
        contentType: input.contentType,
        size,
        checksumSha256: "a".repeat(64),
        createdAt: new Date(),
      };
    }),
    inspect: vi.fn(),
    openRead: vi.fn(),
    createUploadInstruction: vi.fn(),
    createDownloadInstruction: vi.fn(),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as ObjectStorage;
}

const pdf = () =>
  new File(["%PDF-1.7\nunit test"], "floor-plan.pdf", {
    type: "application/pdf",
  });

describe("pdfIngestionService", () => {
  it("streams an immutable PDF revision then queues processing metadata", async () => {
    const repo = repository();
    const objectStorage = storage();
    await expect(
      uploadPdfRevision("drawing-1", " R1 ", pdf(), repo, objectStorage),
    ).resolves.toMatchObject({ jobStatus: "QUEUED" });
    expect(objectStorage.put).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: "application/pdf" }),
    );
    expect(repo.createUploadedRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        revisionCode: "R1",
        originalFileName: "floor-plan.pdf",
      }),
    );
  });

  it.each([
    [
      new File(["not-pdf"], "fake.pdf", { type: "application/pdf" }),
      "PDF_SIGNATURE_INVALID",
    ],
    [
      new File(["%PDF-"], "fake.txt", { type: "text/plain" }),
      "PDF_MIME_INVALID",
    ],
  ])("rejects invalid upload content", async (file, code) => {
    await expect(
      uploadPdfRevision("drawing-1", "R1", file, repository(), storage()),
    ).rejects.toMatchObject({ code });
  });

  it("rejects duplicate revision codes before writing storage", async () => {
    const objectStorage = storage();
    await expect(
      uploadPdfRevision(
        "drawing-1",
        "R1",
        pdf(),
        repository({ revisionCodeExists: vi.fn().mockResolvedValue(true) }),
        objectStorage,
      ),
    ).rejects.toMatchObject({ code: "REVISION_EXISTS" });
    expect(objectStorage.put).not.toHaveBeenCalled();
  });

  it("maps a page only to a floor in the drawing building", async () => {
    const repo = repository();
    await mapDrawingPage(
      "page-1",
      { buildingId: "building-1", floorId: "floor-1" },
      repo,
    );
    expect(repo.mapPageToFloor).toHaveBeenCalledWith(
      "page-1",
      "building-1",
      "floor-1",
    );
    await expect(
      mapDrawingPage(
        "page-1",
        { buildingId: "building-1", floorId: "foreign-floor" },
        repository({
          floorBelongsToBuilding: vi.fn().mockResolvedValue(false),
        }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_PAGE_MAPPING" });
  });
});
