import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { experienceInputSchema, serializeExperience } from "@/lib/experienceApi";

export async function GET() {
  const experiences = await prisma.experience.findMany({
    orderBy: { updatedAt: "desc" },
    include: { highlights: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json(experiences.map(serializeExperience));
}

export async function POST(request: Request) {
  const body = experienceInputSchema.parse(await request.json());
  const created = await prisma.experience.create({
    data: {
      title: body.title,
      org: body.org,
      type: body.type,
      rawInput: body.rawInput,
      sessionId: body.sessionId,
      chatHistory: JSON.stringify(body.chatHistory),
      highlights: {
        create: body.highlights.map((h, index) => ({
          title: h.title,
          situation: h.situation,
          task: h.task,
          action: h.action,
          result: h.result,
          quantify: h.quantify,
          resumeBullet: h.resumeBullet,
          tags: JSON.stringify(h.tags),
          sortOrder: index,
        })),
      },
    },
    include: { highlights: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json(serializeExperience(created));
}
