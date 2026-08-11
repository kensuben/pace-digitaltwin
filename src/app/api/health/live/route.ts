import { NextResponse } from "next/server";

import { getLiveness } from "@/server/services/healthService";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { data: getLiveness(), meta: {}, errors: [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}
