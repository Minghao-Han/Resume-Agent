import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { DEFAULT_TYPST_TEMPLATE, DEFAULT_TEMPLATE_NAME } from "@/lib/defaultTemplate";
import { errorResponse } from "@/lib/apiError";

async function ensureAtLeastOneTemplate() {
  const count = await prisma.resumeTemplate.count();
  if (count === 0) {
    await prisma.resumeTemplate.create({
      data: { name: DEFAULT_TEMPLATE_NAME, typstSource: DEFAULT_TYPST_TEMPLATE, isDefault: true },
    });
  }
}

export async function GET() {
  try {
    await ensureAtLeastOneTemplate();
    const templates = await prisma.resumeTemplate.findMany({ orderBy: { updatedAt: "desc" } });
    return NextResponse.json(templates);
  } catch (err) {
    return errorResponse(err);
  }
}

const createSchema = z.object({
  name: z.string().min(1),
  typstSource: z.string(),
  isDefault: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const body = createSchema.parse(await request.json());
    if (body.isDefault) {
      await prisma.resumeTemplate.updateMany({ data: { isDefault: false } });
    }
    const created = await prisma.resumeTemplate.create({ data: body });
    return NextResponse.json(created);
  } catch (err) {
    return errorResponse(err);
  }
}
