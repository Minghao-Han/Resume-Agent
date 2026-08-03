import { NextResponse } from "next/server";
import { z } from "zod";
import { runAssistantTurn } from "@/lib/agent/assistant";

const bodySchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().optional(),
});

export async function POST(request: Request) {
  const { message, sessionId } = bodySchema.parse(await request.json());
  const result = await runAssistantTurn({ message, sessionId });
  return NextResponse.json(result);
}
