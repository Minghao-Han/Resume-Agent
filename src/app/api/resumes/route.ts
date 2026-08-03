import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/apiError";

const chatMessageSchema = z.object({ role: z.enum(["user", "assistant"]), content: z.string() });

const createSchema = z.object({
  label: z.string(),
  jdSource: z.string(),
  jdIsUrl: z.boolean().default(false),
  company: z.string().default(""),
  targetRoleTag: z.string().default(""),
  typstSource: z.string(),
  selectedHighlightIds: z.array(z.string()).default([]),
  chatHistory: z.array(chatMessageSchema).default([]),
});

function serialize(r: { selectedHighlightIds: string; chatHistory: string; [key: string]: unknown }) {
  return {
    ...r,
    selectedHighlightIds: JSON.parse(r.selectedHighlightIds),
    chatHistory: JSON.parse(r.chatHistory),
  };
}

export async function GET() {
  try {
    const resumes = await prisma.generatedResume.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json(resumes.map(serialize));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = createSchema.parse(await request.json());
    const created = await prisma.generatedResume.create({
      data: {
        ...body,
        selectedHighlightIds: JSON.stringify(body.selectedHighlightIds),
        chatHistory: JSON.stringify(body.chatHistory),
      },
    });
    return NextResponse.json(serialize(created));
  } catch (err) {
    return errorResponse(err);
  }
}
