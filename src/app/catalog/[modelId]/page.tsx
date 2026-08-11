import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppError } from "@/server/errors";
import { getCatalogModel } from "@/server/services/catalogService";

export const dynamic = "force-dynamic";

interface ModelPageProps {
  params: Promise<{ modelId: string }>;
}

export default async function ModelPage({ params }: ModelPageProps) {
  const { modelId } = await params;
  const model = await getCatalogModel(modelId).catch((error: unknown) => {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  });

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <Link
            className="text-sm text-primary hover:underline"
            href="/catalog"
          >
            ← Device Catalog
          </Link>
          <h1 className="mt-3 text-4xl font-bold">{model.modelName}</h1>
          <p className="mt-2 text-muted-foreground">
            {model.vendor.name} · {model.sku} · {model.category}
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Port Profiles</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-2xl text-left text-sm">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="pb-3">Group</th>
                    <th>Count</th>
                    <th>Media</th>
                    <th>Speeds</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {model.portProfiles.map((profile) => (
                    <tr className="border-t" key={profile.id}>
                      <td className="py-3 font-medium">{profile.portGroup}</td>
                      <td>{profile.count}</td>
                      <td>{profile.media}</td>
                      <td>
                        {profile.supportedSpeedsMbps
                          .map((speed) => `${speed / 1000}G`)
                          .join(", ")}
                      </td>
                      <td>{profile.roleHint}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Evidence</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                <span className="text-muted-foreground">Status:</span>{" "}
                {model.specStatus}
              </p>
              <p>
                <span className="text-muted-foreground">Verified:</span>{" "}
                {model.verifiedAt?.toISOString().slice(0, 10) ?? "Not verified"}
              </p>
              <p>
                <span className="text-muted-foreground">
                  Installed instances:
                </span>{" "}
                {model._count.instances}
              </p>
              {model.sourceUrl ? (
                <a
                  className="inline-flex break-all text-primary hover:underline"
                  href={model.sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open source evidence
                </a>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
