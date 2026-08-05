import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { analyzeAndStoreTemplate } from "@/lib/agent/templateCalibration";
import { errorResponse } from "@/lib/apiError";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Manually-triggered ("分析模板" button on /templates) cold-start/refresh
 * calibration — synchronous by design (unlike the old save-time auto-trigger
 * this replaced): the user explicitly asked for this and expects to wait for
 * it, rather than it silently happening after every save.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const template = await prisma.resumeTemplate.findUnique({ where: { id }, select: { typstSource: true } });
    if (!template) return NextResponse.json({ error: "template not found" }, { status: 404 });

    const calibration = await analyzeAndStoreTemplate(id, template.typstSource);
    if (!calibration) {
      return NextResponse.json({ error: "analysis failed — check server logs" }, { status: 500 });
    }
    return NextResponse.json(calibration);
  } catch (err) {
    return errorResponse(err);
  }
}
