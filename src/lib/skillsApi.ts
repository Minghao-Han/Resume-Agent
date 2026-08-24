import { prisma } from "@/lib/db";

/** Case-insensitive dedup against the existing Skill table — safe to call
 * repeatedly (e.g. every time an experience with highlights is saved)
 * without creating duplicates or hitting the `name` unique constraint. */
export async function upsertSkillNames(names: string[]): Promise<void> {
  const trimmed = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (trimmed.length === 0) return;

  const existing = await prisma.skill.findMany({ select: { name: true } });
  const existingLower = new Set(existing.map((s) => s.name.toLowerCase()));
  const toCreate = trimmed.filter((n) => !existingLower.has(n.toLowerCase()));

  if (toCreate.length > 0) {
    await prisma.skill.createMany({ data: toCreate.map((name) => ({ name })) });
  }
}
