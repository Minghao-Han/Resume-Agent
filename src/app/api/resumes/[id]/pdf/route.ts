import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/apiError";

type RouteParams = { params: Promise<{ id: string }> };

const STORAGE_DIR = path.join(process.cwd(), "storage", "resumes");

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const resume = await prisma.generatedResume.findUnique({ where: { id } });
    if (!resume) return NextResponse.json({ error: "not found" }, { status: 404 });

    const bytes = new Uint8Array(await request.arrayBuffer());
    await mkdir(STORAGE_DIR, { recursive: true });
    const filePath = path.join(STORAGE_DIR, `${id}.pdf`);
    await writeFile(filePath, bytes);

    await prisma.generatedResume.update({ where: { id }, data: { pdfPath: filePath } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const resume = await prisma.generatedResume.findUnique({ where: { id } });
    if (!resume?.pdfPath) return NextResponse.json({ error: "not found" }, { status: 404 });

    const bytes = await readFile(resume.pdfPath);
    // Always a fixed ASCII filename — the label is often Chinese ("简历
    // 2026/8/5 16:05:06"), and Content-Disposition's filename="..." must be
    // a valid HTTP header value (Latin-1/ByteString only); a non-ASCII label
    // used directly here throws "Cannot convert argument to a ByteString"
    // and 500s the whole download.
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="resume.pdf"`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
