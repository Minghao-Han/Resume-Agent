import { NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/apiError";

type RouteParams = { params: Promise<{ id: string }> };

const updateSchema = z.object({ typstSource: z.string() });

function serialize(r: { selectedHighlightIds: string; chatHistory: string; [key: string]: unknown }) {
  return {
    ...r,
    selectedHighlightIds: JSON.parse(r.selectedHighlightIds),
    chatHistory: JSON.parse(r.chatHistory),
  };
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const resume = await prisma.generatedResume.findUnique({ where: { id } });
    if (!resume) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(serialize(resume));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = updateSchema.parse(await request.json());
    const existing = await prisma.generatedResume.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
    const updated = await prisma.generatedResume.update({ where: { id }, data: body });
    return NextResponse.json(serialize(updated));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const resume = await prisma.generatedResume.findUnique({ where: { id } });
    if (resume?.pdfPath) {
      await unlink(resume.pdfPath).catch(() => {});
    }
    await prisma.generatedResume.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
