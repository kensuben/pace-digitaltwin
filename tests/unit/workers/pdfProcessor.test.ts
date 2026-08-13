import { describe, expect, it, vi } from "vitest";

import type {
  ClaimedPdfJob,
  PdfIngestionRepository,
} from "@/server/repositories/pdfIngestionRepository";
import type { ObjectStorage } from "@/server/storage/objectStorage";
import { processPdfJob } from "@/workers/pdfProcessor";

function minimalPdf() {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] /Contents 4 0 R >>",
    "<< /Length 0 >>\nstream\n\nendstream",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(body));
}

describe("pdfProcessor", () => {
  it("renders preview and thumbnail then persists page metadata", async () => {
    const source = minimalPdf();
    const stored = new Map<string, Uint8Array>();
    stored.set("source.pdf", source);
    const storage = {
      openRead: vi.fn().mockImplementation(async (key: string) => {
        return (async function* () {
          yield stored.get(key) ?? new Uint8Array();
        })();
      }),
      put: vi.fn().mockImplementation(async (input) => {
        const chunks: Uint8Array[] = [];
        for await (const chunk of input.body) chunks.push(chunk);
        const value = chunks[0] ?? new Uint8Array();
        stored.set(input.key, value);
        return {
          key: input.key,
          contentType: input.contentType,
          size: value.byteLength,
          checksumSha256: "a".repeat(64),
          createdAt: new Date(),
        };
      }),
      delete: vi.fn().mockResolvedValue(undefined),
    } as unknown as ObjectStorage;
    const repository = {
      completeJob: vi.fn().mockResolvedValue(undefined),
    } as unknown as PdfIngestionRepository;
    const job: ClaimedPdfJob = {
      id: "job-1",
      drawingDocumentId: "drawing-1",
      drawingRevisionId: "revision-1",
      campusId: "campus-1",
      buildingId: "building-1",
      storageKey: "source.pdf",
    };

    await processPdfJob(job, repository, storage);

    expect(storage.put).toHaveBeenCalledTimes(2);
    expect(repository.completeJob).toHaveBeenCalledWith(
      job,
      [
        expect.objectContaining({
          pageNumber: 1,
          widthPoints: 200,
          heightPoints: 100,
        }),
      ],
      expect.objectContaining({ processor: "pdfjs-dist", pageCount: 1 }),
    );
  });
});
