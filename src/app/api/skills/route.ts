import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/apiError";

const createSkillSchema = z.object({
  name: z.string().min(1),
  category: z.string().default(""),
});

export async function GET() {
  try {
    const skills = await prisma.skill.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
    return NextResponse.json(skills);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = createSkillSchema.parse(await request.json());
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    // Case-insensitive dedup: a manual "add" that matches an existing skill
    // just returns the existing row instead of erroring.
    const existing = await prisma.skill.findMany();
    const match = existing.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (match) {
      return NextResponse.json(match);
    }

    const created = await prisma.skill.create({ data: { name, category: body.category } });
    return NextResponse.json(created);
  } catch (err) {
    return errorResponse(err);
  }
}
