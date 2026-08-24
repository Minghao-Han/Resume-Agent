import type { ExperienceForPrompt } from "./resumeGen";

export type KeywordGap = {
  /** The highlight tag that matched the JD but isn't backed by a bullet. */
  tag: string;
  /** "missing": tag doesn't appear anywhere in the resume. "skillsOnly": it's
   * only in the bare Skills line, not demonstrated in any Work Experience/
   * Projects bullet. */
  severity: "missing" | "skillsOnly";
  /** Experiences/highlights carrying this tag — candidates to add or restore. */
  candidates: { experienceTitle: string; highlightTitle: string }[];
};

/** Case-insensitive whole-word/whole-token match — avoids "Go" matching "going". */
function containsToken(haystack: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?<![a-zA-Z0-9])${escaped}(?![a-zA-Z0-9])`, "i");
  return re.test(haystack);
}

/** Cuts out the `== Skills` section (up to the next `==` heading) from a Typst
 * resume body, returning what's left — i.e. Education/Work Experience/
 * Projects, the sections where a keyword is actually backed by a bullet
 * rather than just named in a bare list. */
function stripSkillsSection(typstSource: string): string {
  return typstSource.replace(/==\s*Skills[\s\S]*?(?=\n==\s|$)/i, "");
}

/**
 * Deterministic, LLM-free check (no extra generation round, no added
 * latency): for every tag already present on some saved highlight, if that
 * tag also appears in the JD text, verify the generated resume actually
 * backs it up with a bullet — not just a bare mention in the Skills line.
 * Catches the class of bug seen in practice: "C++" listed as a skill with
 * zero bullets demonstrating it, while a real highlight for it (e.g. an
 * embedded C++ project) existed in the pool but wasn't selected.
 *
 * This only checks tags that already exist on the user's own data — it can
 * never invent a keyword the person has no real evidence for.
 */
export function checkKeywordCoverage(
  jdText: string,
  experiences: ExperienceForPrompt[],
  typstSource: string
): KeywordGap[] {
  const tagDisplay = new Map<string, string>(); // lowercased tag -> original casing
  const tagCandidates = new Map<string, { experienceTitle: string; highlightTitle: string }[]>();
  for (const exp of experiences) {
    for (const h of exp.highlights) {
      for (const rawTag of h.tags) {
        const tag = rawTag.trim();
        if (!tag) continue;
        const key = tag.toLowerCase();
        if (!tagDisplay.has(key)) tagDisplay.set(key, tag);
        const list = tagCandidates.get(key) ?? [];
        list.push({ experienceTitle: exp.title, highlightTitle: h.title });
        tagCandidates.set(key, list);
      }
    }
  }

  const bulletText = stripSkillsSection(typstSource);
  const gaps: KeywordGap[] = [];

  for (const [key, displayTag] of tagDisplay) {
    if (!containsToken(jdText, displayTag)) continue; // not something this JD cares about

    const inBullets = containsToken(bulletText, displayTag);
    if (inBullets) continue; // already demonstrated — nothing to flag

    const inSkillsOnly = containsToken(typstSource, displayTag);
    gaps.push({
      tag: displayTag,
      severity: inSkillsOnly ? "skillsOnly" : "missing",
      candidates: tagCandidates.get(key) ?? [],
    });
  }

  return gaps;
}

export function formatKeywordGaps(gaps: KeywordGap[]): string | null {
  if (gaps.length === 0) return null;
  const lines = gaps.map((g) => {
    const where = g.severity === "skillsOnly" ? "listed in Skills but no bullet demonstrates it" : "not on the resume at all";
    const from = g.candidates
      .slice(0, 2)
      .map((c) => `${c.highlightTitle} (${c.experienceTitle})`)
      .join(", ");
    return `- "${g.tag}" — ${where}. The JD mentions it, and you have relevant highlights: ${from}.`;
  });
  return `\n\n⚠️ Keyword coverage check found ${gaps.length} JD-relevant skill(s) not backed by a bullet:\n${lines.join("\n")}`;
}
