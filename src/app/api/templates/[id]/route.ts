import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/apiError";

type RouteParams = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().min(1),
  typstSource: z.string(),
  isDefault: z.boolean().optional(),
});

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const template = await prisma.resumeTemplate.findUnique({ where: { id } });
    if (!template) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(template);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = updateSchema.parse(await request.json());
    const existing = await prisma.resumeTemplate.findUnique({ where: { id } });
    if (body.isDefault) {
      await prisma.resumeTemplate.updateMany({ data: { isDefault: false } });
    }
    // A plain rename shouldn't invalidate a perfectly good existing
    // calibration — only clear it when the actual Typst source changed
    // (the user re-runs "分析模板" explicitly if they want a fresh one;
    // this app no longer recalibrates automatically on every save).
    const sourceChanged = existing?.typstSource !== body.typstSource;
    const updated = await prisma.resumeTemplate.update({
      where: { id },
      data: sourceChanged ? { ...body, calibration: null } : body,
    });
    return NextResponse.json(updated);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    await prisma.resumeTemplate.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
