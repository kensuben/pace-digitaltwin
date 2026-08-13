import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import type {
  ClaimedPdfJob,
  PdfIngestionRepository,
  ProcessedPdfPage,
} from "@/server/repositories/pdfIngestionRepository";
import {
  createDrawingPageObjectKey,
  type ObjectStorage,
} from "@/server/storage/objectStorage";

const MAX_PAGES = 200;
const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
const PREVIEW_WIDTH = 1600;
const THUMBNAIL_WIDTH = 320;

async function readObject(storage: ObjectStorage, key: string) {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of await storage.openRead(key)) {
    const bytes = new Uint8Array(chunk);
    size += bytes.byteLength;
    if (size > MAX_SOURCE_BYTES) throw new Error("PDF_SOURCE_TOO_LARGE");
    chunks.push(bytes);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

async function* oneChunk(bytes: Uint8Array) {
  yield bytes;
}

async function renderPage(
  page: Awaited<
    ReturnType<Awaited<ReturnType<typeof getDocument>["promise"]>["getPage"]>
  >,
  targetWidth: number,
) {
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(targetWidth / base.width, 3);
  const viewport = page.getViewport({ scale });
  if (viewport.width * viewport.height > 20_000_000)
    throw new Error("PDF_PAGE_PIXEL_LIMIT");
  const canvas = createCanvas(
    Math.ceil(viewport.width),
    Math.ceil(viewport.height),
  );
  const context = canvas.getContext("2d");
  await page.render({
    canvas: canvas as never,
    canvasContext: context as never,
    viewport,
    intent: "display",
  }).promise;
  return new Uint8Array(await canvas.encode("webp", 85));
}

export async function processPdfJob(
  job: ClaimedPdfJob,
  repository: PdfIngestionRepository,
  storage: ObjectStorage,
) {
  const source = await readObject(storage, job.storageKey);
  const loadingTask = getDocument({
    data: source,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const document = await loadingTask.promise;
  if (document.numPages < 1 || document.numPages > MAX_PAGES)
    throw new Error("PDF_PAGE_COUNT_LIMIT");

  const storedKeys: string[] = [];
  const pages: ProcessedPdfPage[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const previewStorageKey = createDrawingPageObjectKey({
        campusId: job.campusId,
        documentId: job.drawingDocumentId,
        revisionId: job.drawingRevisionId,
        pageNumber,
        variant: "preview",
        extension: "webp",
      });
      const thumbnailStorageKey = createDrawingPageObjectKey({
        campusId: job.campusId,
        documentId: job.drawingDocumentId,
        revisionId: job.drawingRevisionId,
        pageNumber,
        variant: "thumbnail",
        extension: "webp",
      });
      const preview = await renderPage(page, PREVIEW_WIDTH);
      const thumbnail = await renderPage(page, THUMBNAIL_WIDTH);
      await storage.put({
        key: previewStorageKey,
        contentType: "image/webp",
        body: oneChunk(preview),
        maxBytes: 20 * 1024 * 1024,
      });
      storedKeys.push(previewStorageKey);
      await storage.put({
        key: thumbnailStorageKey,
        contentType: "image/webp",
        body: oneChunk(thumbnail),
        maxBytes: 3 * 1024 * 1024,
      });
      storedKeys.push(thumbnailStorageKey);
      pages.push({
        pageNumber,
        widthPoints: viewport.width,
        heightPoints: viewport.height,
        rotation: viewport.rotation,
        previewStorageKey,
        thumbnailStorageKey,
      });
      page.cleanup();
    }
    const metadata = await document.getMetadata().catch(() => null);
    await repository.completeJob(job, pages, {
      processor: "pdfjs-dist",
      pageCount: document.numPages,
      info: metadata?.info ?? {},
    });
  } catch (error) {
    await Promise.all(storedKeys.map((key) => storage.delete(key)));
    throw error;
  } finally {
    await document.destroy();
  }
}
