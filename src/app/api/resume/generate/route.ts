import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { startResumeGeneration, continueResumeGeneration } from "@/lib/agent/resumeGen";
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

async function handlePost(request: Request) {
  const body = bodySchema.parse(await request.json());

  if (body.sessionId) {
    if (!body.message) {
      return NextResponse.json({ error: "message is required to continue" }, { status: 400 });
    }
    const result = await continueResumeGeneration({ sessionId: body.sessionId, message: body.message });
    return NextResponse.json(result);
  }

  if (!body.jdText || !body.templateId) {
    return NextResponse.json({ error: "jdText and templateId are required to start" }, { status: 400 });
  }

  const [personalInfo, experiences, template] = await Promise.all([
    prisma.personalInfo.findFirst({ include: { educations: { orderBy: { sortOrder: "asc" } } } }),
    prisma.experience.findMany({ include: { highlights: { orderBy: { sortOrder: "asc" } } } }),
    prisma.resumeTemplate.findUnique({ where: { id: body.templateId } }),
  ]);

  if (!template) {
    return NextResponse.json({ error: "template not found" }, { status: 404 });
  }

  const result = await startResumeGeneration({
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
    templateSource: template.typstSource,
  });

  return NextResponse.json(result);
}
