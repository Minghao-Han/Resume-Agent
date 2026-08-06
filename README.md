# Resume Agent

A personal, local-only resume-tailoring tool. It keeps a reusable library of your work/project experience, distills it into structured, quantified resume highlights via AI conversation, and generates a one-page Typst resume tailored to a specific job description — with AI-driven auto-shortening/auto-filling to keep it on exactly one page.

Everything runs on your own machine; data lives in a local SQLite database. There is no account system and no multi-user support — see [`docs/technical-doc.md`](./docs/technical-doc.md#1-project-positioning) for why.

(中文说明见 [`README.cn.md`](./README.cn.md)。)

## Quick Start

```bash
# 1. Install dependencies (postinstall copies Typst's wasm files into public/typst/)
npm install

# 2. Point at a local SQLite database
echo 'DATABASE_URL="file:./dev.db"' > .env

# 3. Apply migrations, create dev.db, generate the Prisma Client
npx prisma migrate dev

# 4. Make sure Claude access works (pick one):
#    - the Claude Code CLI is installed and logged in on this machine, or
#    - ANTHROPIC_API_KEY is set in your environment / .env

# 5. Run it
npm run dev        # development, http://localhost:3000
# or
npm run build && npm run start   # production mode, still local-only
```

There's no in-app settings page for Claude credentials — it relies on whatever Claude access is already configured on the machine running the server.

**Recommended first-time flow**: Templates → Profile → Experience Distillation → Generate Resume (& Save) → review/edit in Resume History. See [`docs/user-manual.md`](./docs/user-manual.md) for the full walkthrough.

## Architecture at a Glance

Next.js (App Router) + Prisma/SQLite, with all AI behavior driven by the Claude Agent SDK.

```
Browser (client components)
   │  fetch via src/lib/apiClient.ts
   ▼
src/app/api/*                 route handlers (Zod-validated)
   │                              │
   │                              ▼
   │                        src/lib/agent/*        one-shot Claude Agent SDK
   │                          core.ts                turns per request, continued
   │                          starq.ts / resumeGen.ts / assistant.ts   via `resume: sessionId`
   │                          autoConverge.ts, templateCalibration.ts, ...
   ▼
Prisma (better-sqlite3 adapter) ──► dev.db (SQLite)
                                       + storage/resumes/*.pdf on disk
```

- **Pages** (`src/app/{experience,generate,resumes,templates,profile}`): Templates → Profile → Experience Distillation → Generate Resume → Resume History, plus a floating "assistant" chat (mounted globally) that edits this repo's own `.claude/CLAUDE.md`/`.claude/skills/` rather than app data.
- **Agent layer** (`src/lib/agent/`): each feature (`starq.ts`, `resumeGen.ts`, `assistant.ts`) is a thin, narrowly-scoped wrapper around `core.ts`'s `runAgentTurn`, each with its own `canUseTool` allowlist and `skills` allowlist so one feature's session can never reach another integration's tools by accident. Resume generation additionally runs through `autoConverge.ts`, which automatically re-prompts the same session up to 3 times to converge on "exactly one page, well filled."
- **Typst compiling** happens twice, on purpose: client-side (`src/lib/typstClient.ts`, WASM in the browser) for live editor previews, and server-side (`src/lib/agent/typstServerCompile.ts`) for the programmatic page-count/fill-ratio measurements the auto-convergence loop and template calibration need inside API routes.
- **Data**: 5 Prisma models (`PersonalInfo`, `Education`, `Experience`, `Highlight`, `ResumeTemplate`, `GeneratedResume`) in SQLite; array/object fields are stored as JSON strings. Session IDs for the Claude Agent SDK are the only "conversation state" the app itself persists — full transcripts live in the CLI's own on-disk session store.

Full architecture, data model, and implementation details (including how unsaved-changes detection works) are in [`docs/technical-doc.md`](./docs/technical-doc.md). Full feature-by-feature usage is in [`docs/user-manual.md`](./docs/user-manual.md).
