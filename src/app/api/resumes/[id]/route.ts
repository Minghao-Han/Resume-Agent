import { NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/apiError";

type RouteParams = { params: Promise<{ id: string }> };

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
