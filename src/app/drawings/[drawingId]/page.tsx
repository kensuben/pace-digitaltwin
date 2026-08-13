import Image from "next/image";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import {
  FloorMappingForm,
  UploadRevisionForm,
} from "@/components/drawings/drawing-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppError } from "@/server/errors";
import { getPdfDrawingDetail } from "@/server/services/pdfIngestionService";

export const dynamic = "force-dynamic";

export default async function DrawingPage({
  params,
}: {
  params: Promise<{ drawingId: string }>;
}) {
  const { drawingId } = await params;
  const raw = await getPdfDrawingDetail(drawingId).catch((error: unknown) => {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  });
  const drawing = raw as {
    id: string;
    name: string;
    status: string;
    pageCount: number | null;
    building: {
      id: string;
      code: string;
      floors: Array<{ id: string; code: string; name: string }>;
    };
    revisions: Array<{
      id: string;
      revisionCode: string;
      status: string;
      originalFileName: string;
    }>;
    pages: Array<{
      id: string;
      pageNumber: number;
      widthPoints: number | null;
      heightPoints: number | null;
      floorId: string | null;
      status: string;
    }>;
    drawingImportJobs: Array<{
      id: string;
      status: string;
      progressPercent: number;
      errorCode: string | null;
      errorMessage: string | null;
    }>;
  };
  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            SP-1 · {drawing.status}
          </p>
          <h1 className="mt-2 text-4xl font-bold">{drawing.name}</h1>
          <p className="mt-2 text-muted-foreground">
            {drawing.building.code} · {drawing.pageCount ?? 0} processed pages
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Upload PDF revision</CardTitle>
          </CardHeader>
          <CardContent>
            <UploadRevisionForm documentId={drawing.id} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Import jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {drawing.drawingImportJobs.length === 0 ? (
                <p className="text-muted-foreground">No jobs yet.</p>
              ) : (
                drawing.drawingImportJobs.map((job) => (
                  <div className="rounded-md border p-3" key={job.id}>
                    <span className="font-semibold">{job.status}</span> ·{" "}
                    {job.progressPercent}%{" "}
                    {job.errorCode
                      ? `· ${job.errorCode}: ${job.errorMessage}`
                      : ""}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pages and floor mapping</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-5 lg:grid-cols-2">
              {drawing.pages.map((page) => (
                <article
                  className="overflow-hidden rounded-lg border"
                  key={page.id}
                >
                  <Image
                    alt={`Page ${page.pageNumber} preview`}
                    className="aspect-[4/3] w-full bg-white object-contain"
                    height={240}
                    src={`/api/drawing-pages/${page.id}/asset?variant=thumbnail`}
                    unoptimized
                    width={320}
                  />
                  <div className="space-y-3 p-4">
                    <p className="font-semibold">
                      Page {page.pageNumber} · {page.status}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {Math.round(page.widthPoints ?? 0)} ×{" "}
                      {Math.round(page.heightPoints ?? 0)} pt
                    </p>
                    <FloorMappingForm
                      buildingId={drawing.building.id}
                      currentFloorId={page.floorId}
                      floors={drawing.building.floors}
                      pageId={page.id}
                    />
                    {page.floorId && (
                      <a
                        className="block text-sm font-semibold text-primary hover:underline"
                        href={`/floors/${page.floorId}/map?scenarioId=scenario-proposed`}
                      >
                        Open 2D floor editor →
                      </a>
                    )}
                    <a
                      className="text-sm font-semibold text-primary hover:underline"
                      href={`/api/drawing-pages/${page.id}/asset`}
                      target="_blank"
                    >
                      Open preview →
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
