import type { PersonalInfoForPrompt } from "./resumeGen";

// Common variable names Typst resume templates use for personal info, mapped
// to the corresponding PersonalInfo field (or null if we have no field for
// it and should just blank it out).
const PERSONAL_INFO_VAR_MAP: Record<
  string,
  "name" | "email" | "phone" | "location" | "github" | "linkedin" | null
> = {
  name: "name",
  fullname: "name",
  author: "name",
  email: "email",
  mail: "email",
  phone: "phone",
  tel: "phone",
  mobile: "phone",
  location: "location",
  address: "location",
  github: "github",
  linkedin: "linkedin",
  website: null,
  homepage: null,
  portfolio: null,
  twitter: null,
};

/**
 * Templates saved via /templates are meant to be reusable style/layout
 * skeletons, but users often start by pasting in an already-personalized
 * template (e.g. copied from their real resume), leaving real name/email/
 * phone/links baked into `#let name = "..."` -style bindings. Relying on the
 * model to always ignore those on every generation call proved unreliable in
 * testing, so this mechanically blanks/replaces the common personal-info
 * variable patterns before the template ever reaches the agent — a
 * deterministic safety net, not a substitute for the prompt instructions.
 *
 * `#import "@preview/...":` lines are left untouched — the browser Typst
 * compiler (typst.ts) fetches Typst Universe packages over the network on
 * demand, so templates that depend on one (e.g. `@preview/basic-resume`)
 * compile here exactly as they would with the real `typst` CLI. See
 * `typstClient.ts` for where the package registry is wired up.
 */
export function sanitizeTemplateSource(templateSource: string, personalInfo: PersonalInfoForPrompt): string {
  const result = templateSource.replace(
    /#let\s+([A-Za-z_][\w-]*)\s*=\s*"((?:[^"\\]|\\.)*)"/g,
    (full: string, varName: string) => {
      const key = varName.toLowerCase();
      if (!(key in PERSONAL_INFO_VAR_MAP)) return full;
      const field = PERSONAL_INFO_VAR_MAP[key];
      const replacement = field ? personalInfo[field] : "";
      return `#let ${varName} = "${replacement.replace(/"/g, '\\"')}"`;
    }
  );

  return result;
}
