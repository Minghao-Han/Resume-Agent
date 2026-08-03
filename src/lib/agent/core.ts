import { query, type Options } from "@anthropic-ai/claude-agent-sdk";

export const PROJECT_ROOT = process.cwd();

export type AgentToolCall = {
  name: string;
  input: Record<string, unknown>;
};

export type AgentTurnResult = {
  sessionId: string | undefined;
  replyText: string;
  toolCalls: AgentToolCall[];
  isError: boolean;
};

/**
 * Runs a single turn against the Claude Agent SDK (which spawns/reuses the
 * local Claude Code CLI, so it rides the user's existing subscription login).
 * Pass `options.resume` with a prior `sessionId` to continue a conversation —
 * each call is a short-lived subprocess, so multi-turn state lives in the
 * CLI's own on-disk session store, not in this Node process.
 */
export async function runAgentTurn(
  prompt: string,
  options: Options
): Promise<AgentTurnResult> {
  let sessionId: string | undefined;
  let replyText = "";
  let isError = false;
  const toolCalls: AgentToolCall[] = [];

  try {
    const q = query({ prompt, options });

    for await (const msg of q) {
      if (msg.type === "system" && msg.subtype === "init") {
        sessionId = msg.session_id;
      } else if (msg.type === "assistant") {
        sessionId = msg.session_id;
        for (const block of msg.message.content) {
          if (block.type === "tool_use") {
            toolCalls.push({
              name: block.name,
              input: (block.input as Record<string, unknown>) ?? {},
            });
          }
        }
      } else if (msg.type === "result") {
        sessionId = msg.session_id;
        if (msg.subtype === "success") {
          replyText = msg.result;
        } else {
          isError = true;
          replyText = msg.errors?.join("\n") || `Agent run failed (${msg.subtype}).`;
        }
      }
    }
  } catch (err) {
    // The CLI subprocess can throw outright (rate/session limits, auth
    // failures, crashes) instead of yielding a graceful result message —
    // surface it the same way so callers/API routes never see an unhandled
    // rejection and can always return valid JSON to the frontend.
    isError = true;
    replyText = err instanceof Error ? err.message : String(err);
  }

  return { sessionId, replyText, toolCalls, isError };
}

/** Pulls the first fenced code block of the given language out of a reply, if present. */
export function extractFencedBlock(text: string, lang: string): string | null {
  const re = new RegExp("```" + lang + "\\n([\\s\\S]*?)```", "i");
  const match = text.match(re);
  return match ? match[1].trim() : null;
}
