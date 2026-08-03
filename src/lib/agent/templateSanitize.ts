import type { PersonalInfoForPrompt } from "./resumeGen";

// Common variable names Typst resume templates use for personal info, mapped
// to the corresponding PersonalInfo field (or null if we have no field for
// it and should just blank it out).
const PERSONAL_INFO_VAR_MAP: Record<string, "name" | "email" | "phone" | "location" | null> = {
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
  github: null,
  linkedin: null,
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
 * Also strips `#import "@preview/...":` lines: this app's Typst compiler has
 * no package registry configured, so any template referencing a Typst
 * Universe package cannot compile here regardless of what the model does.
 */
export function sanitizeTemplateSource(templateSource: string, personalInfo: PersonalInfoForPrompt): string {
  let result = templateSource.replace(/^#import\s+"@preview\/[^"]*"[^\n]*\n?/gm, "");

  result = result.replace(
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
