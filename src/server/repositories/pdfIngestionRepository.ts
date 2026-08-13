import { randomUUID } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "@/server/db/client";

export interface UploadedRevisionInput {
  documentId: string;
  revisionId: string;
  revisionCode: string;
  originalFileName: string;
  fileSize: number;
  checksumSha256: string;
  storageKey: string;
}

export interface ClaimedPdfJob {
  id: string;
  drawingDocumentId: string;
  drawingRevisionId: string;
  campusId: string;
  buildingId: string;
  storageKey: string;
}

export interface ProcessedPdfPage {
  pageNumber: number;
  widthPoints: number;
  heightPoints: number;
  rotation: number;
  previewStorageKey: string;
  thumbnailStorageKey: string;
}

export interface PdfIngestionRepository {
  findUploadContext(documentId: string): Promise<{
    id: string;
    campusId: string;
    buildingId: string;
  } | null>;
  revisionCodeExists(
    documentId: string,
    revisionCode: string,
  ): Promise<boolean>;
  createUploadedRevision(input: UploadedRevisionInput): Promise<{ id: string }>;
  claimNextJob(): Promise<ClaimedPdfJob | null>;
  completeJob(
    job: ClaimedPdfJob,
    pages: ProcessedPdfPage[],
    metadata: Record<string, unknown>,
  ): Promise<void>;
  failJob(jobId: string, code: string, message: string): Promise<void>;
  findPage(pageId: string): Promise<{
    id: string;
    drawingDocumentId: string;
    buildingId: string | null;
    previewStorageKey: string | null;
    thumbnailStorageKey: string | null;
  } | null>;
  mapPageToFloor(
    pageId: string,
    buildingId: string,
    floorId: string,
  ): Promise<void>;
  floorBelongsToBuilding(buildingId: string, floorId: string): Promise<boolean>;
  getDocumentDetail(documentId: string): Promise<unknown | null>;
  listUploadOptions(): Promise<unknown[]>;
}

export class PrismaPdfIngestionRepository implements PdfIngestionRepository {
  private readonly prisma = getPrismaClient();

  findUploadContext(documentId: string) {
    return this.prisma.drawingDocument.findUnique({
      where: { id: documentId },
      select: { id: true, campusId: true, buildingId: true },
    });
  }

  async revisionCodeExists(documentId: string, revisionCode: string) {
    return (
      (await this.prisma.drawingRevision.count({
        where: { drawingDocumentId: documentId, revisionCode },
      })) > 0
    );
  }

  async createUploadedRevision(input: UploadedRevisionInput) {
    const jobId = randomUUID();
    await this.prisma.$transaction([
      this.prisma.drawingRevision.create({
        data: {
          id: input.revisionId,
          drawingDocumentId: input.documentId,
          revisionCode: input.revisionCode,
          originalFileName: input.originalFileName,
          mimeType: "application/pdf",
          fileSize: input.fileSize,
          checksumSha256: input.checksumSha256,
          storageKey: input.storageKey,
          status: "UPLOADED",
        },
      }),
      this.prisma.drawingImportJob.create({
        data: {
          id: jobId,
          drawingDocumentId: input.documentId,
          type: "PDF_RENDER",
          status: "QUEUED",
          currentStep: input.revisionId,
        },
      }),
      this.prisma.drawingDocument.update({
        where: { id: input.documentId },
        data: { status: "PROCESSING" },
      }),
    ]);
    return { id: input.revisionId };
  }

  async claimNextJob(): Promise<ClaimedPdfJob | null> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{
          id: string;
          drawingDocumentId: string;
          drawingRevisionId: string;
        }>
      >`SELECT "id", "drawingDocumentId", "currentStep" AS "drawingRevisionId"
         FROM "DrawingImportJob"
         WHERE "status" = 'QUEUED' AND "type" = 'PDF_RENDER' AND "availableAt" <= NOW()
         ORDER BY "createdAt"
         FOR UPDATE SKIP LOCKED
         LIMIT 1`;
      const claimed = rows[0];
      if (!claimed) return null;
      const revision = await tx.drawingRevision.findUnique({
        where: {
          id_drawingDocumentId: {
            id: claimed.drawingRevisionId,
            drawingDocumentId: claimed.drawingDocumentId,
          },
        },
        include: { drawingDocument: true },
      });
      if (!revision) throw new Error("Queued PDF revision no longer exists.");
      await tx.drawingImportJob.update({
        where: { id: claimed.id },
        data: {
          status: "RUNNING",
          startedAt: new Date(),
          attempts: { increment: 1 },
          progressPercent: 5,
        },
      });
      return {
        id: claimed.id,
        drawingDocumentId: claimed.drawingDocumentId,
        drawingRevisionId: claimed.drawingRevisionId,
        campusId: revision.drawingDocument.campusId,
        buildingId: revision.drawingDocument.buildingId,
        storageKey: revision.storageKey,
      };
    });
  }

  async completeJob(
    job: ClaimedPdfJob,
    pages: ProcessedPdfPage[],
    metadata: Record<string, unknown>,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.drawingPage.deleteMany({
        where: { drawingRevisionId: job.drawingRevisionId },
      });
      await tx.drawingPage.createMany({
        data: pages.map((page) => ({
          ...page,
          drawingDocumentId: job.drawingDocumentId,
          drawingRevisionId: job.drawingRevisionId,
          buildingId: job.buildingId,
          status: "READY" as const,
        })),
      });
      await tx.drawingRevision.update({
        where: {
          id_drawingDocumentId: {
            id: job.drawingRevisionId,
            drawingDocumentId: job.drawingDocumentId,
          },
        },
        data: { status: "READY" },
      });
      await tx.drawingDocument.update({
        where: { id: job.drawingDocumentId },
        data: {
          status: "NEEDS_MAPPING",
          pageCount: pages.length,
          metadataJson: metadata as Prisma.InputJsonValue,
        },
      });
      await tx.drawingImportJob.update({
        where: { id: job.id },
        data: {
          status: "SUCCEEDED",
          progressPercent: 100,
          currentStep: "COMPLETE",
          completedAt: new Date(),
        },
      });
    });
  }

  async failJob(jobId: string, code: string, message: string) {
    const job = await this.prisma.drawingImportJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        errorCode: code,
        errorMessage: message.slice(0, 1000),
        completedAt: new Date(),
      },
    });
    await this.prisma.drawingDocument.update({
      where: { id: job.drawingDocumentId },
      data: { status: "FAILED" },
    });
  }

  findPage(pageId: string) {
    return this.prisma.drawingPage.findUnique({
      where: { id: pageId },
      select: {
        id: true,
        drawingDocumentId: true,
        buildingId: true,
        previewStorageKey: true,
        thumbnailStorageKey: true,
      },
    });
  }

  async mapPageToFloor(pageId: string, buildingId: string, floorId: string) {
    await this.prisma.$transaction(async (tx) => {
      const page = await tx.drawingPage.update({
        where: { id: pageId },
        data: { buildingId, floorId },
        select: { drawingDocumentId: true },
      });
      const unmapped = await tx.drawingPage.count({
        where: { drawingDocumentId: page.drawingDocumentId, floorId: null },
      });
      if (unmapped === 0) {
        await tx.drawingDocument.update({
          where: { id: page.drawingDocumentId },
          data: { status: "READY" },
        });
      }
    });
  }

  async floorBelongsToBuilding(buildingId: string, floorId: string) {
    return (
      (await this.prisma.floor.count({
        where: { id: floorId, buildingId },
      })) === 1
    );
  }

  getDocumentDetail(documentId: string) {
    return this.prisma.drawingDocument.findUnique({
      where: { id: documentId },
      include: {
        campus: true,
        building: { include: { floors: { orderBy: { level: "asc" } } } },
        revisions: { orderBy: { createdAt: "desc" } },
        pages: {
          orderBy: [
            { drawingRevision: { createdAt: "desc" } },
            { pageNumber: "asc" },
          ],
        },
        drawingImportJobs: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
  }

  listUploadOptions() {
    return this.prisma.campus.findMany({
      include: { buildings: { orderBy: { code: "asc" } } },
      orderBy: { code: "asc" },
    });
  }
}
