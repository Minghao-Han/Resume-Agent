import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { startResumeGeneration, continueResumeGeneration } from "@/lib/agent/resumeGen";
import { runConvergenceLoop, MIN_FILL_RATIO, type RoundResult } from "@/lib/agent/autoConverge";
import { measureRealPageHeight } from "@/lib/agent/typstServerCompile";
import { narrowRange } from "@/lib/agent/charRange";
import type { TemplateCalibration } from "@/lib/agent/templateCalibration";
import type { AgentTurnUsage } from "@/lib/agent/core";
import type { ExperienceForPrompt } from "@/lib/agent/resumeGen";
import { checkKeywordCoverage, formatKeywordGaps } from "@/lib/agent/keywordCoverage";
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

/** Total cost/time/tokens across every round of a generation call — the
 * auto-convergence loop can spend several LLM turns per user-visible
 * "generate"/"send" action, so this is what /generate should actually
 * display, not just the first round's usage. */
function sumUsage(rounds: RoundResult[]): AgentTurnUsage {
  return rounds.reduce(
    (acc, r) => ({
      durationMs: acc.durationMs + r.usage.durationMs,
      inputTokens: acc.inputTokens + r.usage.inputTokens,
      outputTokens: acc.outputTokens + r.usage.outputTokens,
      totalCostUsd: acc.totalCostUsd + r.usage.totalCostUsd,
    }),
    { durationMs: 0, inputTokens: 0, outputTokens: 0, totalCostUsd: 0 }
  );
}

async function handlePost(request: Request) {
  const body = bodySchema.parse(await request.json());

  let firstRound: RoundResult;
  let template: { typstSource: string; calibration: string | null } | null = null;
  let experiencesForPrompt: ExperienceForPrompt[] | null = null;

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

    const [personalInfo, experiences, skills, fetchedTemplate] = await Promise.all([
      prisma.personalInfo.findFirst({ include: { educations: { orderBy: { sortOrder: "asc" } } } }),
      prisma.experience.findMany({ include: { highlights: { orderBy: { sortOrder: "asc" } } } }),
      prisma.skill.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
      prisma.resumeTemplate.findUnique({ where: { id: body.templateId } }),
    ]);

    if (!fetchedTemplate) {
      return NextResponse.json({ error: "template not found" }, { status: 404 });
    }
    template = fetchedTemplate;

    experiencesForPrompt = experiences.map((e) => ({
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
    }));

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
        skills: skills.map((s) => ({ name: s.name, category: s.category })),
      },
      experiences: experiencesForPrompt,
      templateSource: fetchedTemplate.typstSource,
      calibration: parseCalibration(fetchedTemplate.calibration),
    });
  }

  // No known template (a "continue" call whose caller didn't pass templateId)
  // or nothing to check (error/no content) — skip the convergence loop, same
  // single-round shape as before.
  if (!template || !firstRound.typstSource || firstRound.isError) {
    return NextResponse.json({
      sessionId: firstRound.sessionId,
      rounds: [firstRound],
      bestIndex: 0,
      isError: firstRound.isError,
      usage: sumUsage([firstRound]),
    });
  }

  const calibration = parseCalibration(template.calibration);
  const realPageHeightPt = calibration?.realPageHeightPt ?? (await measureRealPageHeight(template.typstSource));
  if (realPageHeightPt === null) {
    return NextResponse.json({
      sessionId: firstRound.sessionId,
      rounds: [firstRound],
      bestIndex: 0,
      isError: firstRound.isError,
      usage: sumUsage([firstRound]),
    });
  }

  const { rounds, bestIndex, fits } = await runConvergenceLoop(firstRound, realPageHeightPt);
  // The conversation's actual current session — not necessarily the "best"
  // round's, if an auto-correction overshot; see autoConverge.ts.
  const sessionId = rounds[rounds.length - 1].sessionId;

  // Every real generation call narrows the template's char-count range a bit
  // further, whether or not it needed a correction — a round that landed
  // straight in the acceptable band isn't a boundary sample, so narrowRange
  // is a no-op for it, but overflow/underfill rounds (including corrective
  // ones) are genuine new data.
  if (body.templateId) {
    let range = { low: calibration?.charRangeLow ?? null, high: calibration?.charRangeHigh ?? null };
    for (const fit of fits) {
      range = narrowRange(range, fit, MIN_FILL_RATIO);
    }
    if (range.low !== calibration?.charRangeLow || range.high !== calibration?.charRangeHigh) {
      const updated: TemplateCalibration = {
        charRangeLow: range.low,
        charRangeHigh: range.high,
        realPageHeightPt,
        calibratedAt: new Date().toISOString(),
      };
      await prisma.resumeTemplate.update({
        where: { id: body.templateId },
        data: { calibration: JSON.stringify(updated) },
      });
    }
  }

  // Deterministic, no extra LLM round: flag any JD-relevant tag from the
  // user's own highlight pool that the final resume doesn't actually back up
  // with a bullet (only a bare Skills-line mention, or nothing at all).
  // Only possible on a fresh "start" call — a "continue" call doesn't carry
  // jdText, and a URL JD isn't the JD's actual text.
  if (experiencesForPrompt && body.jdText && !body.jdIsUrl) {
    const best = rounds[bestIndex];
    if (best.typstSource) {
      const gaps = checkKeywordCoverage(body.jdText, experiencesForPrompt, best.typstSource);
      const note = formatKeywordGaps(gaps);
      if (note) {
        rounds[bestIndex] = { ...best, reply: best.reply + note };
      }
    }
  }

  return NextResponse.json({
    sessionId,
    rounds,
    bestIndex,
    isError: rounds[bestIndex].isError,
    usage: sumUsage(rounds),
  });
}
