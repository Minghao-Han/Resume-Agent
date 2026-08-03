import { NextResponse } from "next/server";
import { z } from "zod";
import { runStarQTurn } from "@/lib/agent/starq";
import { errorResponse } from "@/lib/apiError";

const bodySchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const { message, sessionId } = bodySchema.parse(await request.json());
    const result = await runStarQTurn({ message, sessionId });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
