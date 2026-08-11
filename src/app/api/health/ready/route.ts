import { NextResponse } from "next/server";

import { PrismaHealthRepository } from "@/server/repositories/healthRepository";
import { getReadiness } from "@/server/services/healthService";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = await getReadiness(new PrismaHealthRepository());

  return NextResponse.json(
    {
      data: report,
      meta: {},
      errors: report.status === "ok" ? [] : [{ code: "DATABASE_UNAVAILABLE" }],
    },
    {
      status: report.status === "ok" ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
