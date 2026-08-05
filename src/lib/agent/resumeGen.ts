import { z } from "zod";
import { runAgentTurn, PROJECT_ROOT, type AgentTurnUsage } from "./core";
import { sanitizeTemplateSource } from "./templateSanitize";
import { sanitizeGeneratedTypst } from "./typstOutput";
import { estimateTargetCharCount } from "./charRange";
import type { TemplateCalibration } from "./templateCalibration";

export type { AgentTurnUsage } from "./core";

// Scoped to just this app's own resume-writing skills (not the user's
// personal/global skills or Claude Code's bundled ones, which are irrelevant
// noise for this narrow-purpose agent) — see .claude/skills/.
const RESUME_GEN_SKILLS = ["resume-content-and-jd-reading", "resume-one-page-fitting", "resume-generation"];

// Pinned rather than left at the CLI default — profiling showed a single
// initial generation turn taking ~2+ minutes. This task (select from a given
// pool, write within a template's existing structure, follow char-count
// guidance) doesn't need Opus/Sonnet-level reasoning to do well.
const GENERATION_MODEL = "claude-haiku-4-5-20251001";

export type HighlightForPrompt = {
  id: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  quantify: string;
  resumeBullet: string;
  tags: string[];
};

export type ExperienceForPrompt = {
  id: string;
  title: string;
  org: string;
  type: string;
  startDate: string;
  endDate: string;
  location: string;
  highlights: HighlightForPrompt[];
};

export type PersonalInfoForPrompt = {
  name: string;
  phone: string;
  email: string;
  location: string;
  github: string;
  linkedin: string;
  educations: {
    school: string;
    degree: string;
    major: string;
    startDate: string;
    endDate: string;
    region: string;
    relevantCourses: string;
    gpa: string;
  }[];
};

// Enforced at the API level (via Options.outputFormat below) rather than
// asked for as a markdown-fence convention in prose — a smaller/faster model
// (this app pins Haiku for cost/latency) proved unreliable at consistently
// following a multi-part "meta block, then prose, then typst block" text
// convention on its own; a JSON schema is a hard constraint the SDK enforces
// regardless of model size.
const RESUME_OUTPUT_JSON_SCHEMA = {
  type: "object",
  properties: {
    company: {
      type: "string",
      description: "Target company name read from the JD, or an empty string if it can't be determined.",
    },
    role: {
      type: "string",
      description: "Target role/title read from the JD, or an empty string if it can't be determined.",
    },
    explanation: {
      type: "string",
      description: "2-4 sentences explaining what was changed and why.",
    },
    typstSource: {
      type: "string",
      description: "The complete, compilable Typst source for the resume — the full document every time, never a diff.",
    },
  },
  required: ["company", "role", "explanation", "typstSource"],
  additionalProperties: false,
};

const resumeOutputSchema = z.object({
  company: z.string().default(""),
  role: z.string().default(""),
  explanation: z.string().default(""),
  typstSource: z.string(),
});

const SYSTEM_PROMPT = `You write tailored one-page resumes in Typst for a resume-building tool.

You will be given: the user's personal info (including optional GitHub/LinkedIn — include them in the header only if non-empty), a job description (JD, possibly as a URL you must fetch with WebFetch), a library of the user's past experiences, and a Typst template to use as a style/layout reference. Each experience (e.g. one internship) has its own startDate/endDate and optional location (e.g. "Pittsburgh, PA") and contains one or more independently STAR-Q'd highlights, each with its own role tags and a pre-written resumeBullet. Use the experience's own startDate/endDate for its date range on the resume — don't write a placeholder like "[Dates Not Provided]" when they're actually given. Include an experience's location alongside its dates/title only if the template's own layout already has a slot for it and the location is non-empty — don't invent a new layout element just to fit it in.

Your job:
1. Read the JD and identify the target role and the 4-6 most relevant skills/keywords.
2. Select individual highlights (not whole experiences) whose tags/content best match the JD — prefer quantified, relevant results over recency. An experience may contribute all, some, or none of its highlights. Keep the highlights you use grouped under their parent experience/org on the resume, in the order they'd naturally appear (most relevant experiences first).
3. Use each selected highlight's resumeBullet as your starting point, tightened further to fit the page and echo the JD's language — don't paste raw STAR-Q fields verbatim, and don't just copy resumeBullet unedited if it can be sharpened for this specific JD.
4. Produce a complete, compilable Typst source for the resume, following the structure/style of the provided template, that fits on ONE page.
5. Never invent experience, employers, dates, or numbers that are not in the provided data.

CRITICAL — data isolation: the Personal info and Experience library JSON given to you below in the user message are the ONLY facts about this person you may use for resume content. The Typst template is a STYLE/LAYOUT reference only — it may contain a previous user's real filled-in example content (a name, email, school, GitHub/LinkedIn, etc., left over from however the template was authored). Do not copy any concrete fact (name, contact detail, school, employer, date, number, link) out of the template — only its structure, section order, and formatting are yours to reuse. Also do not use any name/contact/school you might recall from account memory, prior conversations, or general knowledge. If a field (e.g. name/email/phone/education) is empty or missing in the Personal info / Experience JSON, leave it as an obvious placeholder like "[Your Name]" in the output and say so in your reply — never fill it in from the template or anywhere else.

CRITICAL — respect the template exactly: the compiler fetches real Typst Universe packages over the network, so if the template starts with \`#import "@preview/...": *\`, keep that import line completely unchanged and use the functions it provides (e.g. \`resume.with(...)\`, \`edu(...)\`, \`work(...)\`, \`project(...)\`) exactly as the template calls them — do NOT redefine \`resume\`/\`edu\`/\`work\`/\`project\`/etc. yourself, do NOT invent your own heading/spacing styling, and do NOT add fields the template's functions don't accept. Your job is to add/edit/remove calls to the template's existing functions with new content, never to rebuild the layout from scratch. Only fall back to writing raw Typst markup for structure the template has no helper for. If the template has no \`@preview\` import at all, follow its plain Typst structure/formatting as closely as possible instead.

CRITICAL — Typst escaping: an unescaped "@" followed by a letter/digit (e.g. "@Version", "@Override", an unescaped email/handle) is parsed by Typst as a citation/label reference and will fail to compile with "label <...> does not exist" — write it as "\\@" instead. Likewise an unescaped "$" followed by a digit (e.g. a dollar amount like "$800") starts Typst math mode and will break compilation or rendering — write it as "\\$" instead. Both apply anywhere in resume prose/bullets, including inside annotation names, handles, emails, or monetary figures.

CRITICAL — Typst interpolation: never write a bare variable interpolation immediately touching an underscore on either side, e.g. \`_#degree_\` to italicize a value — "_" is a valid identifier character in Typst, so \`#degree_\` parses as a reference to a variable literally named "degree_" and swallows the underscore meant to close the emphasis, causing "unclosed delimiter". Always parenthesize the interpolation in that situation: write \`_#(degree)_\` instead.

CRITICAL — Typst bold syntax: to bold text, wrap it in a SINGLE asterisk on each side — \`*bold text*\` — never Markdown's double asterisk (\`**bold text**\`). Typst silently parses \`**text**\` as two empty emphasis toggles around plain, non-bold text — no compile error, no visible sign anything is wrong, just bold that quietly never renders. This applies everywhere you bold something, including the quantified results and JD-matching keywords the resume-generation skill tells you to bold.

Output format (every single reply, including follow-up refinements): your response is returned as structured JSON with fields company, role, explanation, and typstSource — fill in company/role from the JD, explanation with 2-4 sentences on what you changed and why, and typstSource with the COMPLETE current resume Typst source (not a diff, not wrapped in markdown fences — the raw source text). Always include the full source in typstSource so the caller can always re-render from your latest reply alone.

If told the compiled output is more than one page, cut content (shorten bullets, drop the weakest experience) rather than shrinking font/margins below readable sizes.

You have Skill access to this project's own resume-writing skills (resume-content-and-jd-reading, resume-one-page-fitting, resume-generation) — consult them for how to select/prioritize highlights against the JD, how to fit content onto one page, and how to apply bold formatting. Follow their guidance over your own general instincts when they conflict.`;

function buildInitialPrompt(params: {
  jdText: string;
  jdIsUrl: boolean;
  personalInfo: PersonalInfoForPrompt;
  experiences: ExperienceForPrompt[];
  templateSource: string;
  calibration?: TemplateCalibration | null;
}): string {
  const { jdText, jdIsUrl, personalInfo, experiences, templateSource, calibration } = params;
  const cleanedTemplate = sanitizeTemplateSource(templateSource, personalInfo);
  // Rough pre-generation sizing hint from a template's known-good char-count
  // range (see templateCalibration.ts/charRange.ts) — not a rule, just an
  // initial guess the post-generation auto-convergence loop (autoConverge.ts)
  // corrects for afterward regardless of how close this is.
  const charBudget = calibration
    ? estimateTargetCharCount({ low: calibration.charRangeLow, high: calibration.charRangeHigh })
    : null;

  return [
    jdIsUrl
      ? `Job description URL (fetch it with WebFetch first): ${jdText}`
      : `Job description text:\n${jdText}`,
    `\nPersonal info (JSON):\n${JSON.stringify(personalInfo, null, 2)}`,
    `\nExperience library (JSON, each with one or more STAR-Q'd highlights):\n${JSON.stringify(experiences, null, 2)}`,
    `\nTypst template — use it as-is, adding your tailored content via its existing structure/functions. Any \`#let name/email/phone/location = ...\` bindings have already been rewritten to match the Personal info above (or blanked if not provided) — keep them as-is, don't restore whatever the template originally had. If it has an \`#import "@preview/...": *\` line, keep it unchanged and call the functions it provides exactly as the template does:\n\`\`\`typst\n${cleanedTemplate}\n\`\`\``,
    charBudget
      ? `\nRough sizing guide (not a rule): based on this template's known capacity, a resume body (everything after the header/personal-info setup — sections, entries, bullets combined) of roughly ${charBudget} characters tends to closely fill one page. Weigh this alongside actual JD-relevance when choosing how many highlights/bullets to include — relevance still decides which ones, this is only a size target.`
      : "",
    `\nGenerate the tailored one-page resume now.`,
  ].join("\n");
}

type ParsedResumeOutput = { company: string; role: string; reply: string; typstSource: string };

/**
 * Validates the SDK's structured_output against our schema. Falls back to
 * parsing replyText as raw JSON (in case a given CLI/model combination puts
 * the structured payload there instead) before giving up — but does NOT fall
 * back to markdown-fence scraping, since that's exactly the unreliable
 * mechanism structured output replaced.
 */
function parseStructuredOutput(structuredOutput: unknown, replyText: string): ParsedResumeOutput | null {
  const fromStructured = resumeOutputSchema.safeParse(structuredOutput);
  const parsed = fromStructured.success
    ? fromStructured.data
    : (() => {
        try {
          const fromText = resumeOutputSchema.safeParse(JSON.parse(replyText));
          return fromText.success ? fromText.data : null;
        } catch {
          return null;
        }
      })();
  if (!parsed) return null;
  return {
    company: parsed.company,
    role: parsed.role,
    reply: parsed.explanation,
    typstSource: sanitizeGeneratedTypst(parsed.typstSource),
  };
}

export async function startResumeGeneration(params: {
  jdText: string;
  jdIsUrl: boolean;
  personalInfo: PersonalInfoForPrompt;
  experiences: ExperienceForPrompt[];
  templateSource: string;
  calibration?: TemplateCalibration | null;
}): Promise<{
  sessionId: string | undefined;
  reply: string;
  typstSource: string | null;
  company: string;
  role: string;
  isError: boolean;
  usage: AgentTurnUsage;
}> {
  const prompt = buildInitialPrompt(params);

  const { sessionId, replyText, isError, structuredOutput, usage } = await runAgentTurn(prompt, {
    cwd: PROJECT_ROOT,
    model: GENERATION_MODEL,
    systemPrompt: SYSTEM_PROMPT,
    outputFormat: { type: "json_schema", schema: RESUME_OUTPUT_JSON_SCHEMA },
    tools: ["WebFetch", "Skill"],
    allowedTools: ["WebFetch", "Skill"],
    skills: RESUME_GEN_SKILLS,
    settingSources: ["project", "local"],
    settings: { autoMemoryEnabled: false },
    permissionMode: "default",
  });

  const parsed = isError ? null : parseStructuredOutput(structuredOutput, replyText);

  return {
    sessionId,
    reply: parsed?.reply ?? replyText,
    typstSource: parsed?.typstSource ?? null,
    company: parsed?.company ?? "",
    role: parsed?.role ?? "",
    usage,
    isError: isError || !parsed,
  };
}

export async function continueResumeGeneration(params: {
  sessionId: string;
  message: string;
}): Promise<{
  sessionId: string | undefined;
  reply: string;
  typstSource: string | null;
  company: string;
  role: string;
  isError: boolean;
  usage: AgentTurnUsage;
}> {
  const { sessionId, message } = params;

  const { sessionId: newSessionId, replyText, isError, structuredOutput, usage } = await runAgentTurn(message, {
    cwd: PROJECT_ROOT,
    model: GENERATION_MODEL,
    systemPrompt: SYSTEM_PROMPT,
    outputFormat: { type: "json_schema", schema: RESUME_OUTPUT_JSON_SCHEMA },
    tools: ["WebFetch", "Skill"],
    allowedTools: ["WebFetch", "Skill"],
    skills: RESUME_GEN_SKILLS,
    settingSources: ["project", "local"],
    settings: { autoMemoryEnabled: false },
    resume: sessionId,
    permissionMode: "default",
  });

  const parsed = isError ? null : parseStructuredOutput(structuredOutput, replyText);

  return {
    sessionId: newSessionId,
    reply: parsed?.reply ?? replyText,
    isError: isError || !parsed,
    typstSource: parsed?.typstSource ?? null,
    company: parsed?.company ?? "",
    role: parsed?.role ?? "",
    usage,
  };
}
