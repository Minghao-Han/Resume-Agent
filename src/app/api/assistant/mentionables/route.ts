import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { PROJECT_ROOT } from "@/lib/agent/core";
import { errorResponse } from "@/lib/apiError";

const SKILLS_DIR = path.resolve(PROJECT_ROOT, ".claude/skills");

async function exists(candidate: string): Promise<boolean> {
  return fs
    .access(candidate)
    .then(() => true)
    .catch(() => false);
}

/**
 * Lists everything the assistant drawer's chat can @mention: the project
 * memory file and every skill under .claude/skills/ — which may be either
 * a flat `<name>.md` file or a `<name>/SKILL.md` directory, both are valid
 * skill layouts already in use in this project.
 */
export async function GET() {
  try {
    const items: { id: string; label: string }[] = [{ id: "memory", label: "memory" }];

    let entries: import("node:fs").Dirent[] = [];
    try {
      entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
    } catch {
      entries = [];
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (await exists(path.join(SKILLS_DIR, entry.name, "SKILL.md"))) {
          items.push({ id: `skills/${entry.name}`, label: `skills/${entry.name}` });
        }
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        items.push({ id: `skills/${entry.name.slice(0, -3)}`, label: `skills/${entry.name.slice(0, -3)}` });
      }
    }

    return NextResponse.json(items);
  } catch (err) {
    return errorResponse(err);
  }
}
