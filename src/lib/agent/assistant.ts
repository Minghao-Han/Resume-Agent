import path from "node:path";
import { deleteSession, type CanUseTool } from "@anthropic-ai/claude-agent-sdk";
import { runAgentTurn, PROJECT_ROOT } from "./core";

const CLAUDE_DIR = path.resolve(PROJECT_ROOT, ".claude");
const FILE_TOOLS = ["Read", "Write", "Edit"];

function isInsideClaudeDir(candidate: string): boolean {
  const resolved = path.resolve(PROJECT_ROOT, candidate);
  const rel = path.relative(CLAUDE_DIR, resolved);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

// The assistant drawer talks with real Claude Code semantics (settingSources
// on, CLAUDE.md/skills loaded) but is only ever allowed to touch files under
// .claude/ — it must never be able to edit this app's own source code.
export const canUseTool: CanUseTool = async (toolName, input) => {
  if (!FILE_TOOLS.includes(toolName)) {
    return { behavior: "deny", message: `${toolName} is not permitted for the assistant drawer.` };
  }
  const filePath = (input as { file_path?: string }).file_path;
  if (typeof filePath !== "string" || !isInsideClaudeDir(filePath)) {
    return {
      behavior: "deny",
      message: "The assistant drawer may only read/write files under .claude/.",
    };
  }
  return { behavior: "allow" };
};

export async function runAssistantTurn(params: {
  message: string;
  sessionId?: string;
}): Promise<{ sessionId: string | undefined; reply: string; isError: boolean }> {
  const { message, sessionId } = params;

  const { sessionId: newSessionId, replyText, isError } = await runAgentTurn(message, {
    cwd: PROJECT_ROOT,
    systemPrompt: {
      type: "preset",
      preset: "claude_code",
      append:
        "You are embedded in a resume-tailoring app as its in-product assistant. " +
        "You may only read/write files under .claude/ (CLAUDE.md project memory and .claude/skills/) " +
        "to adjust how the app's other agent sessions behave. You cannot see or edit the app's own " +
        "source code, and resume/experience data lives in the app's database, not in files you can reach.",
    },
    tools: FILE_TOOLS,
    allowedTools: FILE_TOOLS,
    settingSources: ["project", "local"],
    settings: { autoMemoryEnabled: false },
    canUseTool,
    resume: sessionId,
    permissionMode: "default",
  });

  return { sessionId: newSessionId, reply: replyText, isError };
}

/**
 * Starts a fresh assistant conversation by deleting the old session's
 * on-disk transcript (not just dropping our reference to it) — best-effort:
 * if the old session is already gone or deletion otherwise fails, that
 * shouldn't block the user from starting a new conversation.
 */
export async function resetAssistantSession(oldSessionId?: string): Promise<void> {
  if (!oldSessionId) return;
  try {
    await deleteSession(oldSessionId, { dir: PROJECT_ROOT });
  } catch {
    // best-effort cleanup; ignore failures (e.g. session already gone)
  }
}
