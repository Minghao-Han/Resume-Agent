import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { startResumeGeneration, continueResumeGeneration } from "@/lib/agent/resumeGen";
import { runConvergenceLoop, type RoundResult } from "@/lib/agent/autoConverge";
import { measureRealPageHeight } from "@/lib/agent/typstServerCompile";
import type { TemplateCalibration } from "@/lib/agent/templateCalibration";
import { errorResponse } from "@/lib/apiError";

const bodySchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().optional(),
  jdText: z.string().optional(),
  jdIsUrl: z.boolean().optional(),
  templateId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    return await handlePost(request);
  } catch (err) {
    return errorResponse(err);
  }
}

function parseCalibration(raw: string | null | undefined): TemplateCalibration | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TemplateCalibration;
  } catch {
    return null;
  }
}

async function handlePost(request: Request) {
  const body = bodySchema.parse(await request.json());

  let firstRound: RoundResult;
  let template: { typstSource: string; calibration: string | null } | null = null;

  if (body.sessionId) {
    if (!body.message) {
      return NextResponse.json({ error: "message is required to continue" }, { status: 400 });
    }
    firstRound = await continueResumeGeneration({ sessionId: body.sessionId, message: body.message });
    if (body.templateId) {
      template = await prisma.resumeTemplate.findUnique({
        where: { id: body.templateId },
        select: { typstSource: true, calibration: true },
      });
    }
  } else {
    if (!body.jdText || !body.templateId) {
      return NextResponse.json({ error: "jdText and templateId are required to start" }, { status: 400 });
    }

    const [personalInfo, experiences, fetchedTemplate] = await Promise.all([
      prisma.personalInfo.findFirst({ include: { educations: { orderBy: { sortOrder: "asc" } } } }),
      prisma.experience.findMany({ include: { highlights: { orderBy: { sortOrder: "asc" } } } }),
      prisma.resumeTemplate.findUnique({ where: { id: body.templateId } }),
    ]);

    if (!fetchedTemplate) {
      return NextResponse.json({ error: "template not found" }, { status: 404 });
    }
    template = fetchedTemplate;

    firstRound = await startResumeGeneration({
      jdText: body.jdText,
      jdIsUrl: body.jdIsUrl ?? false,
      personalInfo: {
        name: personalInfo?.name ?? "",
        phone: personalInfo?.phone ?? "",
        email: personalInfo?.email ?? "",
        location: personalInfo?.location ?? "",
        github: personalInfo?.github ?? "",
        linkedin: personalInfo?.linkedin ?? "",
        educations: (personalInfo?.educations ?? []).map((e) => ({
          school: e.school,
          degree: e.degree,
          major: e.major,
          startDate: e.startDate,
          endDate: e.endDate,
          region: e.region,
          relevantCourses: e.relevantCourses,
          gpa: e.gpa,
        })),
      },
      experiences: experiences.map((e) => ({
        id: e.id,
        title: e.title,
        org: e.org,
        type: e.type,
        startDate: e.startDate,
        endDate: e.endDate,
        location: e.location,
        highlights: e.highlights.map((h) => ({
          id: h.id,
          title: h.title,
          situation: h.situation,
          task: h.task,
          action: h.action,
          result: h.result,
          quantify: h.quantify,
          resumeBullet: h.resumeBullet,
          tags: JSON.parse(h.tags),
        })),
      })),
      templateSource: fetchedTemplate.typstSource,
      calibration: parseCalibration(fetchedTemplate.calibration),
    });
  }

  // No known template (a "continue" call whose caller didn't pass templateId)
  // or nothing to check (error/no content) — skip the convergence loop, same
  // single-round shape as before.
  if (!template || !firstRound.typstSource || firstRound.isError) {
    return NextResponse.json({ sessionId: firstRound.sessionId, rounds: [firstRound], bestIndex: 0, isError: firstRound.isError });
  }

  const calibration = parseCalibration(template.calibration);
  const realPageHeightPt = calibration?.realPageHeightPt ?? (await measureRealPageHeight(template.typstSource));
  if (realPageHeightPt === null) {
    return NextResponse.json({ sessionId: firstRound.sessionId, rounds: [firstRound], bestIndex: 0, isError: firstRound.isError });
  }

  const { rounds, bestIndex } = await runConvergenceLoop(firstRound, realPageHeightPt);
  // The conversation's actual current session — not necessarily the "best"
  // round's, if an auto-correction overshot; see autoConverge.ts.
  const sessionId = rounds[rounds.length - 1].sessionId;

  return NextResponse.json({ sessionId, rounds, bestIndex, isError: rounds[bestIndex].isError });
}
