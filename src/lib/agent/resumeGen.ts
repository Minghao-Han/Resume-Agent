import { runAgentTurn, extractFencedBlock } from "./core";
import { sanitizeTemplateSource } from "./templateSanitize";

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
  highlights: HighlightForPrompt[];
};

export type PersonalInfoForPrompt = {
  name: string;
  phone: string;
  email: string;
  location: string;
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

const SYSTEM_PROMPT = `You write tailored one-page resumes in Typst for a resume-building tool.

You will be given: the user's personal info, a job description (JD, possibly as a URL you must fetch with WebFetch), a library of the user's past experiences, and a Typst template to use as a style/layout reference. Each experience (e.g. one internship) contains one or more independently STAR-Q'd highlights, each with its own role tags and a pre-written resumeBullet.

Your job:
1. Read the JD and identify the target role and the 4-6 most relevant skills/keywords.
2. Select individual highlights (not whole experiences) whose tags/content best match the JD — prefer quantified, relevant results over recency. An experience may contribute all, some, or none of its highlights. Keep the highlights you use grouped under their parent experience/org on the resume, in the order they'd naturally appear (most relevant experiences first).
3. Use each selected highlight's resumeBullet as your starting point, tightened further to fit the page and echo the JD's language — don't paste raw STAR-Q fields verbatim, and don't just copy resumeBullet unedited if it can be sharpened for this specific JD.
4. Produce a complete, compilable Typst source for the resume, following the structure/style of the provided template, that fits on ONE page.
5. Never invent experience, employers, dates, or numbers that are not in the provided data.

CRITICAL — data isolation: the Personal info and Experience library JSON given to you below in the user message are the ONLY facts about this person you may use for resume content. The Typst template is a STYLE/LAYOUT reference only — it may contain a previous user's real filled-in example content (a name, email, school, GitHub/LinkedIn, etc., left over from however the template was authored). Do not copy any concrete fact (name, contact detail, school, employer, date, number, link) out of the template — only its structure, section order, and formatting are yours to reuse. Also do not use any name/contact/school you might recall from account memory, prior conversations, or general knowledge. If a field (e.g. name/email/phone/education) is empty or missing in the Personal info / Experience JSON, leave it as an obvious placeholder like "[Your Name]" in the output and say so in your reply — never fill it in from the template or anywhere else.

CRITICAL — Typst constraints: the compiler here has no package registry access. Never write \`#import "@preview/..."\` or reference any external Typst package — the compile will fail. If the given template originally depended on one (its import line will already be stripped by the time you see it), rebuild the same visual structure using only plain Typst markup/functions instead of calling whatever functions that package would have provided (e.g. don't call \`resume.with(...)\` or similar if \`resume\` was never actually defined in what you were given).

Output format (every single reply, including follow-up refinements): first briefly explain what you changed and why in 2-4 sentences, then output the COMPLETE current resume Typst source (not a diff) in a fenced code block tagged \`\`\`typst. Always include the full source so the caller can always re-render from your latest reply alone.

If told the compiled output is more than one page, cut content (shorten bullets, drop the weakest experience) rather than shrinking font/margins below readable sizes.`;

function buildInitialPrompt(params: {
  jdText: string;
  jdIsUrl: boolean;
  personalInfo: PersonalInfoForPrompt;
  experiences: ExperienceForPrompt[];
  templateSource: string;
}): string {
  const { jdText, jdIsUrl, personalInfo, experiences, templateSource } = params;
  const cleanedTemplate = sanitizeTemplateSource(templateSource, personalInfo);
  return [
    jdIsUrl
      ? `Job description URL (fetch it with WebFetch first): ${jdText}`
      : `Job description text:\n${jdText}`,
    `\nPersonal info (JSON):\n${JSON.stringify(personalInfo, null, 2)}`,
    `\nExperience library (JSON, each with one or more STAR-Q'd highlights):\n${JSON.stringify(experiences, null, 2)}`,
    `\nTypst template — style/layout reference only. Any \`#let name/email/phone/location = ...\` bindings have already been rewritten to match the Personal info above (or blanked if not provided) — keep them as-is, don't restore whatever the template originally had. Any \`#import "@preview/..."\` line has been removed since package fetching isn't available here; do not re-add it or reference undefined functions it would have provided — write the equivalent structure in plain Typst instead:\n\`\`\`typst\n${cleanedTemplate}\n\`\`\``,
    `\nGenerate the tailored one-page resume now.`,
  ].join("\n");
}

export async function startResumeGeneration(params: {
  jdText: string;
  jdIsUrl: boolean;
  personalInfo: PersonalInfoForPrompt;
  experiences: ExperienceForPrompt[];
  templateSource: string;
}): Promise<{ sessionId: string | undefined; reply: string; typstSource: string | null }> {
  const prompt = buildInitialPrompt(params);

  const { sessionId, replyText } = await runAgentTurn(prompt, {
    systemPrompt: SYSTEM_PROMPT,
    tools: ["WebFetch"],
    allowedTools: ["WebFetch"],
    settingSources: [],
    settings: { autoMemoryEnabled: false },
    permissionMode: "default",
  });

  return { sessionId, reply: replyText, typstSource: extractFencedBlock(replyText, "typst") };
}

export async function continueResumeGeneration(params: {
  sessionId: string;
  message: string;
}): Promise<{ sessionId: string | undefined; reply: string; typstSource: string | null }> {
  const { sessionId, message } = params;

  const { sessionId: newSessionId, replyText } = await runAgentTurn(message, {
    systemPrompt: SYSTEM_PROMPT,
    tools: ["WebFetch"],
    allowedTools: ["WebFetch"],
    settingSources: [],
    settings: { autoMemoryEnabled: false },
    resume: sessionId,
    permissionMode: "default",
  });

  return {
    sessionId: newSessionId,
    reply: replyText,
    typstSource: extractFencedBlock(replyText, "typst"),
  };
}
