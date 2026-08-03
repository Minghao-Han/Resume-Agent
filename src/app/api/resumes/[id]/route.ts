import { NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

function serialize(r: { selectedHighlightIds: string; chatHistory: string; [key: string]: unknown }) {
  return {
    ...r,
    selectedHighlightIds: JSON.parse(r.selectedHighlightIds),
    chatHistory: JSON.parse(r.chatHistory),
  };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const resume = await prisma.generatedResume.findUnique({ where: { id } });
  if (!resume) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(serialize(resume));
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const resume = await prisma.generatedResume.findUnique({ where: { id } });
  if (resume?.pdfPath) {
    await unlink(resume.pdfPath).catch(() => {});
  }
  await prisma.generatedResume.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
