import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { createSdkMcpServer, deleteSession, tool, type CanUseTool } from "@anthropic-ai/claude-agent-sdk";
import { runAgentTurn, PROJECT_ROOT } from "./core";

const CLAUDE_DIR = path.resolve(PROJECT_ROOT, ".claude");
const FILE_TOOLS = ["Read", "Write", "Edit"];

const DELETE_SERVER_NAME = "claude_dir_fs";
const DELETE_TOOL_NAME = "delete_claude_file";
const FULL_DELETE_TOOL_NAME = `mcp__${DELETE_SERVER_NAME}__${DELETE_TOOL_NAME}`;

/** Resolves `candidate` (relative to .claude/) and reports whether it stays inside .claude/ — and, separately, whether it IS .claude/ itself (never a valid delete/write target). */
function resolveInsideClaudeDir(candidate: string): { resolved: string; insideOrIsRoot: boolean; isRoot: boolean } {
  const resolved = path.resolve(CLAUDE_DIR, candidate);
  const rel = path.relative(CLAUDE_DIR, resolved);
  const isRoot = rel === "";
  const insideOrIsRoot = isRoot || (!rel.startsWith("..") && !path.isAbsolute(rel));
  return { resolved, insideOrIsRoot, isRoot };
}

function isInsideClaudeDir(candidate: string): boolean {
  // file_path from Read/Write/Edit tools is resolved relative to cwd (PROJECT_ROOT), not .claude/.
  const resolved = path.resolve(PROJECT_ROOT, candidate);
  const rel = path.relative(CLAUDE_DIR, resolved);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function buildDeleteServer() {
  return createSdkMcpServer({
    name: DELETE_SERVER_NAME,
    tools: [
      tool(
        DELETE_TOOL_NAME,
        "Permanently deletes a file or whole skill directory under .claude/ — e.g. 'skills/resume-one-page-fitting' " +
          "(a skill directory), 'skills/star-q-extraction.md' (a flat skill file), or 'CLAUDE.md' (project memory). " +
          "Only call this when the user explicitly asks to delete/remove a skill or reset memory, never as a side " +
          "effect of an edit.",
        { path: z.string().describe("Path relative to .claude/, e.g. 'skills/resume-one-page-fitting'.") },
        async ({ path: relPath }) => {
          const { resolved, insideOrIsRoot, isRoot } = resolveInsideClaudeDir(relPath);
          if (!insideOrIsRoot || isRoot) {
            return {
              content: [{ type: "text", text: `Refused: "${relPath}" is not a valid file/directory inside .claude/.` }],
              isError: true,
            };
          }
          try {
            await fs.rm(resolved, { recursive: true, force: false });
            return { content: [{ type: "text", text: `Deleted ${relPath}.` }] };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { content: [{ type: "text", text: `Failed to delete ${relPath}: ${message}` }], isError: true };
          }
        },
        { alwaysLoad: true }
      ),
    ],
    alwaysLoad: true,
  });
}

// The assistant drawer talks with real Claude Code semantics (settingSources
// on, CLAUDE.md/skills loaded) but is only ever allowed to touch files under
// .claude/ — it must never be able to edit this app's own source code.
export const canUseTool: CanUseTool = async (toolName, input) => {
  if (toolName === FULL_DELETE_TOOL_NAME) {
    // The tool handler itself enforces the .claude/ boundary (see buildDeleteServer above).
    return { behavior: "allow" };
  }
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
        "source code, and resume/experience data lives in the app's database, not in files you can reach.\n\n" +
        "Skills live under .claude/skills/ as either a flat '<name>.md' file or a '<name>/SKILL.md' " +
        "directory — both are valid. The chat UI lets the user @mention a specific target, which shows up " +
        "in their message as a note like 'The user @mentioned skills/<name>' (meaning .claude/skills/<name>.md " +
        "or .claude/skills/<name>/SKILL.md, whichever exists) or 'The user @mentioned memory' (meaning " +
        `.claude/CLAUDE.md) — when present, scope your read/update/delete to exactly that target. Use the ` +
        `${DELETE_TOOL_NAME} tool (path relative to .claude/, e.g. 'skills/<name>' or 'CLAUDE.md') only when ` +
        "the user explicitly asks to delete a skill or reset memory, and confirm exactly what you deleted in your reply.",
    },
    tools: FILE_TOOLS,
    allowedTools: [...FILE_TOOLS, FULL_DELETE_TOOL_NAME],
    mcpServers: { [DELETE_SERVER_NAME]: buildDeleteServer() },
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
