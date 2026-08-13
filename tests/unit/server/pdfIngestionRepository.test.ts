import { describe, expect, it } from "vitest";

import { toUnmappedDrawingPageRows } from "@/server/repositories/pdfIngestionRepository";

describe("PDF ingestion persistence", () => {
  it("creates an unmapped page with a valid null location pair", () => {
    const rows = toUnmappedDrawingPageRows(
      {
        id: "job-1",
        drawingDocumentId: "drawing-1",
        drawingRevisionId: "revision-1",
        campusId: "campus-1",
        buildingId: "building-1",
        storageKey: "source.pdf",
      },
      [
        {
          pageNumber: 1,
          widthPoints: 200,
          heightPoints: 100,
          rotation: 0,
          previewStorageKey: "preview.webp",
          thumbnailStorageKey: "thumbnail.webp",
        },
      ],
    );

    expect(rows[0]).toMatchObject({
      drawingDocumentId: "drawing-1",
      drawingRevisionId: "revision-1",
      buildingId: null,
      floorId: null,
      status: "READY",
    });
  });
});
