import { z } from "zod";
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { runAgentTurn, type AgentToolCall } from "./core";

const SERVER_NAME = "starq";
const TOOL_NAME = "submit_star_q";
const FULL_TOOL_NAME = `mcp__${SERVER_NAME}__${TOOL_NAME}`;

export type StarQResult = {
  situation: string;
  task: string;
  action: string;
  result: string;
  quantify: string;
  tags: string[];
};

const starQShape = {
  situation: z.string().describe("The context/problem, 1-2 sentences."),
  task: z.string().describe("What the user was specifically responsible for."),
  action: z.string().describe("What they concretely did."),
  result: z.string().describe("The outcome, in plain language."),
  quantify: z
    .string()
    .describe(
      "The result restated with a number (%, time saved, scale, revenue, users, etc). Empty string if not askable/available yet."
    ),
  tags: z
    .array(z.string())
    .describe("2-5 role tags this experience is a strong fit for, e.g. 'backend', 'data science'."),
};

function buildStarQServer() {
  return createSdkMcpServer({
    name: SERVER_NAME,
    tools: [
      tool(
        TOOL_NAME,
        "Submit the structured STAR-Q extraction result for the experience being discussed. " +
          "Must be called exactly once in every single reply in this conversation, even if the " +
          "extraction is still incomplete or you are only asking a clarifying question.",
        starQShape,
        async () => {
          return {
            content: [{ type: "text", text: "Received STAR-Q submission." }],
          };
        },
        { alwaysLoad: true }
      ),
    ],
    alwaysLoad: true,
  });
}

const SYSTEM_PROMPT = `You extract internship/project experience descriptions into STAR-Q format for a resume-building tool.

STAR-Q fields:
- Situation: context/problem, 1-2 sentences.
- Task: what the user was specifically responsible for.
- Action: what they concretely did (avoid vague verbs like "helped with").
- Result: the outcome, in plain language.
- Quantify: the result restated with a number. If the user's text has no number, leave quantify empty and ask them for one in your reply instead of inventing it.

Also propose 2-5 role tags (e.g. "backend", "data science", "PM", "frontend") this experience is a strong fit for.

HARD REQUIREMENT: call the ${TOOL_NAME} tool exactly once in EVERY reply you send in this conversation — no exceptions. This is not optional and is not just for "final" answers: even a reply that's only a clarifying question must still call the tool first with your current best-effort values (use an empty string "" for any field you don't have yet). A text-only reply with no tool call is a mistake. After calling the tool, add your explanation or clarifying question as your text reply. On follow-up turns, incorporate the user's clarifications and call the tool again with the updated result.`;

function findStarQCall(toolCalls: AgentToolCall[]): StarQResult | null {
  const call = toolCalls.find((c) => c.name === FULL_TOOL_NAME || c.name === TOOL_NAME);
  if (!call) return null;
  const input = call.input as Partial<StarQResult>;
  return {
    situation: input.situation ?? "",
    task: input.task ?? "",
    action: input.action ?? "",
    result: input.result ?? "",
    quantify: input.quantify ?? "",
    tags: Array.isArray(input.tags) ? input.tags : [],
  };
}

export async function runStarQTurn(params: {
  message: string;
  sessionId?: string;
}): Promise<{ sessionId: string | undefined; reply: string; starQ: StarQResult | null }> {
  const { message, sessionId } = params;

  const { sessionId: newSessionId, replyText, toolCalls } = await runAgentTurn(message, {
    systemPrompt: SYSTEM_PROMPT,
    tools: [],
    allowedTools: [FULL_TOOL_NAME],
    mcpServers: { [SERVER_NAME]: buildStarQServer() },
    settingSources: [],
    resume: sessionId,
    permissionMode: "default",
  });

  return {
    sessionId: newSessionId,
    reply: replyText,
    starQ: findStarQCall(toolCalls),
  };
}
