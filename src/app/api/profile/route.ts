import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const educationSchema = z.object({
  id: z.string().optional(),
  school: z.string(),
  degree: z.string(),
  major: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  region: z.string().default(""),
  relevantCourses: z.string().default(""),
  gpa: z.string().default(""),
});

const profileSchema = z.object({
  name: z.string(),
  phone: z.string(),
  email: z.string(),
  location: z.string(),
  educations: z.array(educationSchema),
});

async function getOrCreatePersonalInfo() {
  const existing = await prisma.personalInfo.findFirst({
    include: { educations: { orderBy: { sortOrder: "asc" } } },
  });
  if (existing) return existing;
  return prisma.personalInfo.create({
    data: {},
    include: { educations: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function GET() {
  const info = await getOrCreatePersonalInfo();
  return NextResponse.json(info);
}

export async function PUT(request: Request) {
  const body = profileSchema.parse(await request.json());
  const current = await getOrCreatePersonalInfo();

  const updated = await prisma.$transaction(async (tx) => {
    await tx.personalInfo.update({
      where: { id: current.id },
      data: { name: body.name, phone: body.phone, email: body.email, location: body.location },
    });
    await tx.education.deleteMany({ where: { personalInfoId: current.id } });
    if (body.educations.length > 0) {
      await tx.education.createMany({
        data: body.educations.map((edu, index) => ({
          school: edu.school,
          degree: edu.degree,
          major: edu.major,
          startDate: edu.startDate,
          endDate: edu.endDate,
          region: edu.region,
          relevantCourses: edu.relevantCourses,
          gpa: edu.gpa,
          sortOrder: index,
          personalInfoId: current.id,
        })),
      });
    }
    return tx.personalInfo.findUniqueOrThrow({
      where: { id: current.id },
      include: { educations: { orderBy: { sortOrder: "asc" } } },
    });
  });

  return NextResponse.json(updated);
}
