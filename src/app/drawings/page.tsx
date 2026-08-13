import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { CreateDrawingForm } from "@/components/drawings/drawing-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listDrawingDocuments } from "@/server/services/drawingService";
import { listDrawingUploadOptions } from "@/server/services/pdfIngestionService";

export const dynamic = "force-dynamic";

export default async function DrawingsPage() {
  const [drawings, campuses] = await Promise.all([
    listDrawingDocuments({}),
    listDrawingUploadOptions(),
  ]);
  const typedCampuses = campuses as Array<{
    id: string;
    code: string;
    buildings: Array<{ id: string; code: string; name: string }>;
  }>;
  const locations = typedCampuses.flatMap((campus) =>
    campus.buildings.map((building) => ({
      campusId: campus.id,
      buildingId: building.id,
      label: `${campus.code} / ${building.code} — ${building.name}`,
    })),
  );
  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            SP-1
          </p>
          <h1 className="mt-2 text-4xl font-bold">PDF Drawings</h1>
          <p className="mt-3 text-muted-foreground">
            Upload immutable PDF revisions, process previews asynchronously and
            map pages to floors.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Create drawing</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateDrawingForm locations={locations} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{drawings.length} drawing documents</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="pb-3">Name</th>
                  <th>Building</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Pages</th>
                </tr>
              </thead>
              <tbody>
                {drawings.map((drawing) => (
                  <tr className="border-t" key={drawing.id}>
                    <td className="py-4">
                      <Link
                        className="font-semibold text-primary hover:underline"
                        href={`/drawings/${drawing.id}`}
                      >
                        {drawing.name}
                      </Link>
                    </td>
                    <td>
                      {drawing.campus.code} / {drawing.building.code}
                    </td>
                    <td>{drawing.documentType}</td>
                    <td>{drawing.status}</td>
                    <td>{drawing.pageCount ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
