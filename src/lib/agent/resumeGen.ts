import { runAgentTurn, extractFencedBlock } from "./core";

export type ExperienceForPrompt = {
  id: string;
  title: string;
  org: string;
  type: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  quantify: string;
  tags: string[];
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

You will be given: the user's personal info, a job description (JD, possibly as a URL you must fetch with WebFetch), a library of the user's past experiences (each already distilled into STAR-Q form with role tags), and a Typst template to use as a style/layout reference.

Your job:
1. Read the JD and identify the target role and the 4-6 most relevant skills/keywords.
2. Select the experiences whose tags/content best match the JD — prefer quantified, relevant results over recency. Do not use experiences that don't fit.
3. Rewrite each selected experience's result/quantify into a tight resume bullet (do not paste the raw STAR-Q fields verbatim).
4. Produce a complete, compilable Typst source for the resume, following the structure/style of the provided template, that fits on ONE page.
5. Never invent experience, employers, dates, or numbers that are not in the provided data.

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
  return [
    jdIsUrl
      ? `Job description URL (fetch it with WebFetch first): ${jdText}`
      : `Job description text:\n${jdText}`,
    `\nPersonal info (JSON):\n${JSON.stringify(personalInfo, null, 2)}`,
    `\nExperience library (JSON, each already in STAR-Q form):\n${JSON.stringify(experiences, null, 2)}`,
    `\nTypst template to use as style/layout reference:\n\`\`\`typst\n${templateSource}\n\`\`\``,
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
    resume: sessionId,
    permissionMode: "default",
  });

  return {
    sessionId: newSessionId,
    reply: replyText,
    typstSource: extractFencedBlock(replyText, "typst"),
  };
}
