import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const chatMessageSchema = z.object({ role: z.enum(["user", "assistant"]), content: z.string() });

const createSchema = z.object({
  label: z.string(),
  jdSource: z.string(),
  jdIsUrl: z.boolean().default(false),
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
  const resumes = await prisma.generatedResume.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(resumes.map(serialize));
}

export async function POST(request: Request) {
  const body = createSchema.parse(await request.json());
  const created = await prisma.generatedResume.create({
    data: {
      ...body,
      selectedHighlightIds: JSON.stringify(body.selectedHighlightIds),
      chatHistory: JSON.stringify(body.chatHistory),
    },
  });
  return NextResponse.json(serialize(created));
}
