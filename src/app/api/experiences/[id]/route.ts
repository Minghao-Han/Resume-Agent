import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { experienceInputSchema, serializeExperience } from "@/lib/experienceApi";
import { upsertSkillNames } from "@/lib/skillsApi";
import { errorResponse } from "@/lib/apiError";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const exp = await prisma.experience.findUnique({
      where: { id },
      include: { highlights: { orderBy: { sortOrder: "asc" } } },
    });
    if (!exp) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(serializeExperience(exp));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = experienceInputSchema.parse(await request.json());

    const updated = await prisma.$transaction(async (tx) => {
      await tx.experience.update({
        where: { id },
        data: {
          title: body.title,
          org: body.org,
          type: body.type,
          startDate: body.startDate,
          endDate: body.endDate,
          location: body.location,
          rawInput: body.rawInput,
          sessionId: body.sessionId,
          chatHistory: JSON.stringify(body.chatHistory),
        },
      });
      await tx.highlight.deleteMany({ where: { experienceId: id } });
      if (body.highlights.length > 0) {
        await tx.highlight.createMany({
          data: body.highlights.map((h, index) => ({
            title: h.title,
            situation: h.situation,
            task: h.task,
            action: h.action,
            result: h.result,
            quantify: h.quantify,
            resumeBullet: h.resumeBullet,
            tags: JSON.stringify(h.tags),
            skills: JSON.stringify(h.skills),
            sortOrder: index,
            experienceId: id,
          })),
        });
      }
      return tx.experience.findUniqueOrThrow({
        where: { id },
        include: { highlights: { orderBy: { sortOrder: "asc" } } },
      });
    });

    await upsertSkillNames(body.highlights.flatMap((h) => h.skills));
    return NextResponse.json(serializeExperience(updated));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    await prisma.experience.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
