import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

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

function serialize(exp: {
  tags: string;
  chatHistory: string;
  [key: string]: unknown;
}) {
  return {
    ...exp,
    tags: JSON.parse(exp.tags),
    chatHistory: JSON.parse(exp.chatHistory),
  };
}

export async function GET() {
  const experiences = await prisma.experience.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json(experiences.map(serialize));
}

export async function POST(request: Request) {
  const body = experienceSchema.parse(await request.json());
  const created = await prisma.experience.create({
    data: {
      ...body,
      tags: JSON.stringify(body.tags),
      chatHistory: JSON.stringify(body.chatHistory),
    },
  });
  return NextResponse.json(serialize(created));
}
