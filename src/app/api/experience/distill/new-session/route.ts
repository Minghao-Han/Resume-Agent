import { NextResponse } from "next/server";
import { z } from "zod";
import { resetStarQSession } from "@/lib/agent/starq";
import { errorResponse } from "@/lib/apiError";

const bodySchema = z.object({
  sessionId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const { sessionId } = bodySchema.parse(await request.json());
    await resetStarQSession(sessionId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
