import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

const STORAGE_DIR = path.join(process.cwd(), "storage", "resumes");

export async function PUT(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const resume = await prisma.generatedResume.findUnique({ where: { id } });
  if (!resume) return NextResponse.json({ error: "not found" }, { status: 404 });

  const bytes = new Uint8Array(await request.arrayBuffer());
  await mkdir(STORAGE_DIR, { recursive: true });
  const filePath = path.join(STORAGE_DIR, `${id}.pdf`);
  await writeFile(filePath, bytes);

  await prisma.generatedResume.update({ where: { id }, data: { pdfPath: filePath } });
  return NextResponse.json({ ok: true });
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const resume = await prisma.generatedResume.findUnique({ where: { id } });
  if (!resume?.pdfPath) return NextResponse.json({ error: "not found" }, { status: 404 });

  const bytes = await readFile(resume.pdfPath);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${resume.label.replace(/["\n]/g, "")}.pdf"`,
    },
  });
}
