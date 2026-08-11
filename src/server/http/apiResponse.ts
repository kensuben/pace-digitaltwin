import { NextResponse } from "next/server";

import { asAppError } from "@/server/errors";

export function apiSuccess<T>(data: T, meta: Record<string, unknown> = {}) {
  return NextResponse.json(
    { data, meta, errors: [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export function apiCreated<T>(data: T) {
  return NextResponse.json(
    { data, meta: {}, errors: [] },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

export function apiError(error: unknown) {
  const appError = asAppError(error);
  if (appError.code === "INTERNAL_ERROR") {
    console.error(error);
  }

  return NextResponse.json(
    {
      data: null,
      meta: {},
      errors: [{ code: appError.code, message: appError.message }],
    },
    {
      status: appError.status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
