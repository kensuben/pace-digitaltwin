import { describe, expect, it, vi } from "vitest";

import type {
  DrawingDocumentRecord,
  DrawingRepository,
} from "@/server/repositories/drawingRepository";
import {
  createDrawingDocument,
  deleteDrawingDocument,
  getDrawingDocument,
  listDrawingDocuments,
  parseDrawingFilters,
  updateDrawingDocument,
} from "@/server/services/drawingService";

function drawing(references = 0) {
  return {
    id: "drawing-1",
    name: "T03 floor plan",
    _count: {
      revisions: references,
      pages: 0,
      drawingImportJobs: 0,
      models3d: 0,
    },
  } as unknown as DrawingDocumentRecord;
}

function repository(overrides: Partial<DrawingRepository> = {}) {
  return {
    list: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(drawing()),
    locationExists: vi.fn().mockResolvedValue(true),
    create: vi.fn().mockResolvedValue(drawing()),
    update: vi.fn().mockResolvedValue(drawing()),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as DrawingRepository;
}

const validInput = {
  campusId: "campus-1",
  buildingId: "building-1",
  name: " T03 floor plan ",
  documentType: "FLOOR_PLAN",
  uploadedBy: "developer",
};

describe("drawingService", () => {
  it("creates metadata only for a building in the selected campus", async () => {
    const repo = repository();
    await createDrawingDocument(validInput, repo);
    expect(repo.locationExists).toHaveBeenCalledWith("campus-1", "building-1");
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "T03 floor plan",
        documentType: "FLOOR_PLAN",
      }),
    );
  });

  it("rejects invalid input and mismatched location", async () => {
    await expect(
      createDrawingDocument({ ...validInput, name: "" }, repository()),
    ).rejects.toMatchObject({ code: "INVALID_DRAWING" });
    await expect(
      createDrawingDocument(
        validInput,
        repository({ locationExists: vi.fn().mockResolvedValue(false) }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_DRAWING_LOCATION" });
  });

  it("gets, updates and deletes an unreferenced document", async () => {
    const repo = repository();
    await expect(getDrawingDocument("drawing-1", repo)).resolves.toMatchObject({
      id: "drawing-1",
    });
    await updateDrawingDocument("drawing-1", { name: "Updated" }, repo);
    expect(repo.update).toHaveBeenCalledWith("drawing-1", { name: "Updated" });
    await deleteDrawingDocument("drawing-1", repo);
    expect(repo.delete).toHaveBeenCalledWith("drawing-1");
  });

  it("rejects missing, empty updates and retention-sensitive deletes", async () => {
    await expect(
      getDrawingDocument(
        "missing",
        repository({ findById: vi.fn().mockResolvedValue(null) }),
      ),
    ).rejects.toMatchObject({ code: "DRAWING_NOT_FOUND" });
    await expect(
      updateDrawingDocument("drawing-1", {}, repository()),
    ).rejects.toMatchObject({ code: "INVALID_DRAWING" });
    await expect(
      deleteDrawingDocument(
        "drawing-1",
        repository({ findById: vi.fn().mockResolvedValue(drawing(1)) }),
      ),
    ).rejects.toMatchObject({ code: "DRAWING_IN_USE" });
  });

  it("normalizes list filters and ignores invalid enums", async () => {
    const repo = repository();
    await listDrawingDocuments({ search: " floor " }, repo);
    expect(repo.list).toHaveBeenCalledWith({ search: "floor" });
    expect(
      parseDrawingFilters({
        documentType: "INVALID",
        status: "READY",
        campusId: "campus-1",
      }),
    ).toEqual({
      campusId: "campus-1",
      buildingId: undefined,
      documentType: undefined,
      status: "READY",
      search: undefined,
    });
  });
});
