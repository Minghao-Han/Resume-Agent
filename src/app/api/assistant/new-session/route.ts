import { NextResponse } from "next/server";
import { z } from "zod";
import { resetAssistantSession } from "@/lib/agent/assistant";
import { errorResponse } from "@/lib/apiError";

const bodySchema = z.object({
  sessionId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const { sessionId } = bodySchema.parse(await request.json());
    await resetAssistantSession(sessionId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
