import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** Ensures API routes always return valid JSON on failure instead of letting
 * Next.js's default (HTML/empty) error response reach the frontend's
 * res.json() call. */
export function errorResponse(err: unknown) {
  if (err instanceof ZodError) {
    return NextResponse.json({ error: "Invalid request", issues: err.issues }, { status: 400 });
  }
  const message = err instanceof Error ? err.message : String(err);
  return NextResponse.json({ error: message }, { status: 500 });
}
