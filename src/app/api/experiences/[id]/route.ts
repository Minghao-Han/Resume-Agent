import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

const chatMessageSchema = z.object({ role: z.enum(["user", "assistant"]), content: z.string() });

const experienceSchema = z.object({
  title: z.string(),
  org: z.string(),
  type: z.enum(["intern", "project"]),
  rawInput: z.string(),
  situation: z.string().default(""),
  task: z.string().default(""),
  action: z.string().default(""),
  result: z.string().default(""),
  quantify: z.string().default(""),
  tags: z.array(z.string()).default([]),
  chatHistory: z.array(chatMessageSchema).default([]),
  sessionId: z.string().optional(),
});

function serialize(exp: { tags: string; chatHistory: string; [key: string]: unknown }) {
  return { ...exp, tags: JSON.parse(exp.tags), chatHistory: JSON.parse(exp.chatHistory) };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const exp = await prisma.experience.findUnique({ where: { id } });
  if (!exp) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(serialize(exp));
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = experienceSchema.parse(await request.json());
  const updated = await prisma.experience.update({
    where: { id },
    data: { ...body, tags: JSON.stringify(body.tags), chatHistory: JSON.stringify(body.chatHistory) },
  });
  return NextResponse.json(serialize(updated));
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  await prisma.experience.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
