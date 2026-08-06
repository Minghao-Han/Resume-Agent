import { z } from "zod";
import { createSdkMcpServer, tool, type CanUseTool } from "@anthropic-ai/claude-agent-sdk";
import { runAgentTurn, PROJECT_ROOT, type AgentToolCall } from "./core";

// Scoped to just this app's own highlight-extraction skills (not the user's
// personal/global skills or Claude Code's bundled ones) — see .claude/skills/.
const STARQ_SKILLS = ["resume-highlight-extraction", "star-q-extraction"];

const SERVER_NAME = "starq";
const TOOL_NAME = "submit_highlights";
const FULL_TOOL_NAME = `mcp__${SERVER_NAME}__${TOOL_NAME}`;

// See resumeGen.ts for why this is needed: `tools`/`allowedTools` don't
// restrict MCP-server tools inherited via settingSources, so without an
// explicit canUseTool allowlist this session could reach the user's other
// MCP integrations (e.g. Google Drive) despite having nothing to do with them.
const ALLOWED_TOOL_NAMES = new Set([FULL_TOOL_NAME, "Skill"]);
const canUseTool: CanUseTool = async (toolName) => {
  if (ALLOWED_TOOL_NAMES.has(toolName)) return { behavior: "allow" };
  return { behavior: "deny", message: `${toolName} is not permitted for highlight extraction.` };
};

export type HighlightResult = {
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  quantify: string;
  resumeBullet: string;
  tags: string[];
};

const highlightShape = {
  title: z.string().describe("Short name for this specific achievement/highlight, e.g. 'Fixed an unauthorized access vulnerability'."),
  situation: z.string().describe("The context/problem, 1-2 sentences."),
  task: z.string().describe("What the user was specifically responsible for."),
  action: z.string().describe("What they concretely did."),
  result: z.string().describe("The outcome, in plain language."),
  quantify: z
    .string()
    .describe(
      "The result restated with a number (%, time saved, scale, revenue, users, etc). Empty string if not askable/available yet."
    ),
  resumeBullet: z
    .string()
    .describe("A single polished, resume-ready bullet synthesizing this highlight's STAR-Q (not the raw fields pasted together)."),
  tags: z
    .array(z.string())
    .describe("2-5 role tags this highlight is a strong fit for, e.g. 'backend', 'data science'."),
};

function buildStarQServer() {
  return createSdkMcpServer({
    name: SERVER_NAME,
    tools: [
      tool(
        TOOL_NAME,
        "Submit the full current list of structured highlights extracted from this experience. " +
          "One experience often contains multiple distinct, independently STAR-Q'd achievements — " +
          "submit ALL of them (not just new ones); this call always replaces the caller's whole list. " +
          "Must be called exactly once in every single reply in this conversation, even if extraction " +
          "is still incomplete or you are only asking a clarifying question.",
        { highlights: z.array(z.object(highlightShape)) },
        async () => {
          return {
            content: [{ type: "text", text: "Received highlights submission." }],
          };
        },
        { alwaysLoad: true }
      ),
    ],
    alwaysLoad: true,
  });
}

const SYSTEM_PROMPT = `You extract internship/project experience descriptions into a list of distinct, resume-worthy highlights for a resume-building tool. A single experience (e.g. one internship) very often contains MULTIPLE separate achievements/projects/incidents — each of those should become its own highlight with its own STAR-Q breakdown, not one merged blob. Only split into multiple highlights when the source text genuinely describes distinct pieces of work; a short, single-achievement description should stay as one highlight.

For each highlight, produce:
- Title: a short name for the achievement.
- Situation: context/problem, 1-2 sentences.
- Task: what the user was specifically responsible for.
- Action: what they concretely did (avoid vague verbs like "helped with"). If there were multiple viable approaches and the user chose one, capture that reasoning — it's valuable resume/interview material.
- Result: the outcome, in plain language.
- Quantify: the result restated with a number. If the user's text has no number, leave quantify empty and ask them for one in your reply instead of inventing it.
- Resume bullet: one polished, resume-ready sentence synthesizing the above (not the raw fields concatenated).
- Tags: 2-5 role tags this highlight is a strong fit for (e.g. "backend", "security", "data science", "PM").

On follow-up turns the user message may start with a "Current highlights (JSON, ...)" block giving you the exact current state of every highlight (with a stable "index"), reflecting any manual edits made in the UI since your last reply — treat this JSON as ground truth over your own memory of earlier turns. It may be followed by a note like "The user @mentioned highlight index(es) 2 in their message below" — that means the user's request (in the "User message:" part) applies ONLY to that highlight(s) by index; copy every other highlight from the JSON into your tool call completely unchanged (same title/situation/task/action/result/quantify/resumeBullet/tags), and only modify the targeted one(s). If no index is mentioned, use your judgment on which highlight(s) the free-form request refers to, or treat it as applying broadly (e.g. a new highlight to add, or a request affecting all of them).

HARD REQUIREMENT: call the ${TOOL_NAME} tool exactly once in EVERY reply you send in this conversation — no exceptions. This is not optional and is not just for "final" answers: even a reply that's only a clarifying question must still call the tool first with your current best-effort list (use an empty string "" for any field you don't have yet, never invent numbers or facts not in the source text). The tool call always carries the FULL current list of highlights, including ones from earlier turns (or from the "Current highlights" JSON) that haven't changed. After calling the tool, add your explanation or clarifying questions (per-highlight, if there are gaps) as your text reply. On follow-up turns, incorporate the user's clarifications and call the tool again with the updated full list.

You have Skill access to this project's own extraction skills (resume-highlight-extraction, star-q-extraction) — consult them for the five lenses for finding highlights, verification discipline, and output-format guidance. Follow their guidance over your own general instincts when they conflict.`;

function findHighlightsCall(toolCalls: AgentToolCall[]): HighlightResult[] | null {
  const call = toolCalls.find((c) => c.name === FULL_TOOL_NAME || c.name === TOOL_NAME);
  if (!call) return null;
  const highlights = (call.input as { highlights?: unknown }).highlights;
  if (!Array.isArray(highlights)) return null;
  return highlights.map((h) => {
    const input = h as Partial<HighlightResult>;
    return {
      title: input.title ?? "",
      situation: input.situation ?? "",
      task: input.task ?? "",
      action: input.action ?? "",
      result: input.result ?? "",
      quantify: input.quantify ?? "",
      resumeBullet: input.resumeBullet ?? "",
      tags: Array.isArray(input.tags) ? input.tags : [],
    };
  });
}

export async function runStarQTurn(params: {
  message: string;
  sessionId?: string;
}): Promise<{
  sessionId: string | undefined;
  reply: string;
  highlights: HighlightResult[] | null;
  isError: boolean;
}> {
  const { message, sessionId } = params;

  const { sessionId: newSessionId, replyText, toolCalls, isError } = await runAgentTurn(message, {
    cwd: PROJECT_ROOT,
    systemPrompt: SYSTEM_PROMPT,
    tools: ["Skill"],
    allowedTools: [FULL_TOOL_NAME, "Skill"],
    skills: STARQ_SKILLS,
    mcpServers: { [SERVER_NAME]: buildStarQServer() },
    settingSources: ["project", "local"],
    settings: { autoMemoryEnabled: false },
    resume: sessionId,
    permissionMode: "default",
    canUseTool,
  });

  return {
    sessionId: newSessionId,
    reply: replyText,
    highlights: isError ? null : findHighlightsCall(toolCalls),
    isError,
  };
}
