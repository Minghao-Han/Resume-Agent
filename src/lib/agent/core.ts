import { query, type Options } from "@anthropic-ai/claude-agent-sdk";

export const PROJECT_ROOT = process.cwd();

export type AgentToolCall = {
  name: string;
  input: Record<string, unknown>;
};

export type AgentTurnUsage = {
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
};

const ZERO_USAGE: AgentTurnUsage = { durationMs: 0, inputTokens: 0, outputTokens: 0, totalCostUsd: 0 };

export type AgentTurnResult = {
  sessionId: string | undefined;
  replyText: string;
  toolCalls: AgentToolCall[];
  isError: boolean;
  /** Present when options.outputFormat requested structured JSON output and
   * the model complied — the SDK enforces the schema at the API level, which
   * is far more reliable than asking a (especially smaller/faster) model to
   * remember a specific markdown-fence convention on its own. Callers should
   * still validate the shape (e.g. with zod) before trusting it. */
  structuredOutput?: unknown;
  /** Zeroed out if the turn errored before a result message arrived (e.g. the
   * CLI subprocess threw outright) — there's nothing real to report then. */
  usage: AgentTurnUsage;
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
  let structuredOutput: unknown;
  let usage: AgentTurnUsage = ZERO_USAGE;
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
          structuredOutput = msg.structured_output;
          usage = {
            durationMs: msg.duration_ms,
            inputTokens: msg.usage.input_tokens,
            outputTokens: msg.usage.output_tokens,
            totalCostUsd: msg.total_cost_usd,
          };
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

  return { sessionId, replyText, toolCalls, isError, structuredOutput, usage };
}

/** Pulls the first fenced code block of the given language out of a reply, if present. */
export function extractFencedBlock(text: string, lang: string): string | null {
  const re = new RegExp("```" + lang + "\\n([\\s\\S]*?)```", "i");
  const match = text.match(re);
  return match ? match[1].trim() : null;
}

/** Like extractFencedBlock, but returns every match — e.g. several labeled calibration variants in one reply. */
export function extractAllFencedBlocks(text: string, lang: string): string[] {
  const re = new RegExp("```" + lang + "\\n([\\s\\S]*?)```", "gi");
  return [...text.matchAll(re)].map((m) => m[1].trim());
}
