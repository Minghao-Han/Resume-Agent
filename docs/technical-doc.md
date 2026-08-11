# Technical Documentation

For developers maintaining or picking up this project. Covers: overall architecture, tech stack, and the concrete implementation of several key mechanisms (especially "unsaved-changes detection," which tends to get asked about but is spread across several files in the code).

For product/feature-level documentation, see [`user-manual.md`](./user-manual.md).

(中文版见 [`technical-doc.cn.md`](./technical-doc.cn.md)。)

---

## 1. Project Positioning

A personal, locally-run full-stack app (Next.js + Prisma/SQLite) for tailoring a resume to a specific JD. **Single-user, no auth, no multi-tenancy** — `.claude/CLAUDE.md` states this explicitly, the Prisma schema has no `User` model, and `PersonalInfo` is effectively a singleton table (the code always does `findFirst`). No test framework is configured (no jest/vitest/playwright), and `README.md` (before this doc was added) was an unmodified `create-next-app` template.

## 2. Tech Stack

| Category | Dependency | Version | Notes |
|---|---|---|---|
| Framework | `next` | 16.2.12 | App Router, only `src/app/`, no `pages/` |
| | `react` / `react-dom` | 19.2.4 | |
| | `typescript` | ^5 | |
| DB / ORM | `prisma` / `@prisma/client` | ^7.9.1 | generator output redirected to `src/generated/prisma` (non-default location) |
| | `@prisma/adapter-better-sqlite3` | ^7.9.1 | Prisma 7's driver-adapter pattern, replacing the bundled query engine |
| AI / Agent | `@anthropic-ai/claude-agent-sdk` | ^0.3.220 | All AI capability goes through this one package; **no** direct use of `@anthropic-ai/sdk` (the raw Messages API) |
| | `zod` | ^4.4.3 | API route input validation + agent structured-output validation + MCP tool schemas |
| Editor / highlighting | `@uiw/react-codemirror` | ^4.25.11 | React wrapper for CodeMirror 6 |
| | `@codemirror/language` | ^6.12.4 | Only used for `StreamLanguage`/`StreamParser`, to build the custom Typst highlighting mode |
| Typst compiling | `@myriaddreamin/typst.ts` | ^0.7.0 | Browser-side `$typst` singleton wrapper |
| | `@myriaddreamin/typst-ts-web-compiler` | ^0.7.0 | wasm compiler binary |
| | `@myriaddreamin/typst-ts-renderer` | ^0.7.0 | wasm renderer binary |
| Styling | `tailwindcss` / `@tailwindcss/postcss` | ^4 | v4's PostCSS-plugin setup, no `tailwind.config.js` |
| Misc | `uuid` | ^14.0.1 | |
| | `dotenv` | ^17.4.2 | Only explicitly imported in `prisma.config.ts`, since the Prisma CLI/config context doesn't go through Next.js's own env loading |

**RSC usage is minimal**: only `src/app/layout.tsx` (root layout) and `src/app/page.tsx` (home page) are plain Server Components; every other page and shared component is marked `"use client"`. No Server Actions are used — all data flows through the single path "client component → `src/lib/apiClient.ts` → `src/app/api/*` route" — there's no RSC-side server data fetching.

## 3. Directory Structure

```
src/app/                    App Router pages + API routes
  experience/                Experience Distillation page
  generate/                  Generate Resume page
  profile/                   Profile page
  resumes/                   Resume History page
  templates/                 Templates page
  api/
    assistant/               Floating-assistant chat endpoints (+ new-session, mentionables)
    experience/distill/      Experience-distillation chat endpoints (+ new-session)
    experiences/[id]/        Experience CRUD
    profile/                 Profile CRUD
    resume/generate/         Resume-generation chat endpoint (runs autoConverge internally)
    resumes/[id]/            Resume-history CRUD (+ pdf sub-route)
    templates/[id]/          Template CRUD (+ analyze sub-route)

src/components/              AssistantDrawer / ChatPanel / NavBar / ToastHost / TypstPreview

src/lib/                     Cross-cutting utilities: db.ts / apiClient.ts / apiError.ts /
                             defaultTemplate.ts / experienceApi.ts / toast.ts /
                             typstClient.ts / typstLanguage.ts / unsavedChanges.tsx /
                             useIsDarkMode.ts

src/lib/agent/               All Claude Agent SDK logic
  core.ts                    Lowest level: runAgentTurn, wraps the SDK's query()
  assistant.ts                Floating assistant
  starq.ts                    Experience distillation (STAR-Q)
  resumeGen.ts                 Resume generation
  autoConverge.ts               Auto-convergence loop for generated output
  charRange.ts                   Pure math: template-capacity estimation
  templateCalibration.ts          The "Analyze Template" feature
  templateSanitize.ts             Template sanitization before generation
  typstOutput.ts / typstServerCompile.ts   Server-side Typst compilation & text processing (no SDK calls)

prisma/                      schema.prisma + migrations/ (8 migrations)
.claude/                     CLAUDE.md (project memory) + skills/ (this tool's own skill docs)
public/typst/                Destination for the two wasm binaries (generated by postinstall, not in git)
scripts/copy-typst-wasm.mjs  postinstall script
storage/resumes/             Saved resumes' PDF files, flat directory as <id>.pdf
```

## 4. Data Model (`prisma/schema.prisma`)

| Model | Key fields | Notes |
|---|---|---|
| `PersonalInfo` | name/phone/email/location/github/linkedin, `educations Education[]` | Effectively a singleton (code always uses `findFirst`) |
| `Education` | school/degree/major/startDate/endDate/region/relevantCourses/gpa/sortOrder | `onDelete: Cascade` under `PersonalInfo` |
| `Experience` | title/org/type/startDate/endDate/location/rawInput, `chatHistory String` (JSON string), `sessionId String?`, `highlights Highlight[]` | One Experience can produce multiple Highlights (explicitly documented in a schema comment) |
| `Highlight` | situation/task/action/result/quantify/resumeBullet, `tags String` (JSON string array), sortOrder | `onDelete: Cascade` under `Experience` |
| `ResumeTemplate` | name/typstSource, `isDefault Boolean`, `calibration String?` (JSON string) | `calibration` is actually written as `{charRangeLow, charRangeHigh, realPageHeightPt, calibratedAt}`; the richer shape described in the schema comment looks like a leftover/unimplemented earlier design |
| `GeneratedResume` | label/jdSource/jdIsUrl/company/targetRoleTag/typstSource, `selectedHighlightIds String`, `chatHistory String`, `sessionId String?`, `pdfPath String?` | |

**Design trade-off**: every field that needs to store an array/object (`chatHistory`, `tags`, `selectedHighlightIds`, `calibration`) is a `String` holding JSON-serialized text, rather than a native JSON column — a common SQLite + Prisma compromise, requiring manual `JSON.parse`/`JSON.stringify` on read/write (every route that needs this has a local `serialize()` helper — duplicated separately in `src/app/api/resumes/route.ts` and `src/app/api/resumes/[id]/route.ts`, not factored into a shared module).

## 5. Claude Agent SDK Session Mechanics

### 5.1 The base layer: `runAgentTurn` (`src/lib/agent/core.ts`)

```
PROJECT_ROOT = process.cwd()   // used as cwd for every call, so the SDK loads
                                // this repo's own .claude/CLAUDE.md and .claude/skills/
```

`runAgentTurn(prompt, options)` calls the SDK's `query({ prompt, options })`. Key points:

- The model is "**one one-shot SDK call per HTTP request**" — not a long-lived connection, not a multi-turn state machine living in a resident process. The SDK spawns or reuses the local Claude Code CLI subprocess, riding the user's existing subscription login on this machine.
- Multi-turn conversation state does **not** live in this Node process — it lives in the Claude Code CLI's own on-disk session store. (Source comment, verbatim: *"each call is a short-lived subprocess, so multi-turn state lives in the CLI's own on-disk session store, not in this Node process."*) Continuation is done by passing `options.resume = sessionId`; the app's own database/frontend state **only ever stores this opaque sessionId string**, never replaying message history locally.
- Concurrency: since each call is an independent subprocess keyed by `sessionId`, different sessions are naturally isolated from each other — but there is **no mutex/queue** guarding concurrent requests against the *same* `sessionId`, since this is a single-user local tool where that race is not expected to matter.
- Error handling: the entire async-generator consumption loop is wrapped in try/catch, converting subprocess-level exceptions (auth failures, rate limits, crashes) uniformly into `{ isError: true }`, so API routes never throw an unhandled rejection and can always return valid JSON.
- `permissionMode: "default"` is explicitly set in every feature module's call — since this is an unattended backend call with no UI to pop a permission prompt, every tool-use allow/deny decision must be resolved entirely in code via `canUseTool` (see below).

### 5.2 How feature modules compose on top of `core.ts`

| Module | Purpose | System prompt | Skills allowlist | Tool allowlist (canUseTool) |
|---|---|---|---|---|
| `assistant.ts` | Floating assistant, edits files under `.claude/` | Claude Code's official preset + appended scoping instructions | Not set (relies on `settingSources` so it can discover every skill) | `Read/Write/Edit` (path must resolve inside `.claude/`) + custom MCP tool `delete_claude_file` |
| `starq.ts` | Experience-distillation chat | Custom system prompt | `resume-highlight-extraction`, `star-q-extraction`, `resume-bullet-writing` | Only `mcp__starq__submit_highlights` + `Skill` |
| `resumeGen.ts` | Resume-generation chat | Custom system prompt, `model` pinned to `claude-haiku-4-5-20251001`, `thinking: {type:"disabled"}` | `resume-content-and-jd-reading`, `resume-one-page-fitting`, `resume-generation`, `resume-bullet-writing` | Only `WebFetch/Skill/StructuredOutput` |
| `autoConverge.ts` | Auto multi-round convergence of generated output | Doesn't call `core.ts` directly — reuses `resumeGen.ts`'s `continueResumeGeneration` | — | — |
| `charRange.ts` | Pure math (capacity estimation) | No SDK involvement, deliberately zero-dependency to avoid a circular import between `templateCalibration.ts` and `resumeGen.ts` | — | — |
| `templateCalibration.ts` | The "Analyze Template" feature | Orchestrates `resumeGen.ts` + `autoConverge.ts` + `typstServerCompile.ts` + `charRange.ts`, reads/writes `prisma.resumeTemplate` directly | — | — |
| `typstServerCompile.ts` / `typstOutput.ts` | Server-side Typst compilation and text cleanup | No SDK involvement | — | — |

**Why `resumeGen.ts` pins the model to `claude-haiku-4-5-20251001` and disables thinking**: an in-file comment records a real measured comparison — without pinning/with thinking on, one round measured 6900–9500 output tokens and 70–110 seconds; with it off, roughly 1800 tokens and ~20 seconds. This is a deliberate latency/cost optimization, not default behavior.

### 5.3 `canUseTool`: why it has to exist

This is the single most important safety comment in the codebase, from `resumeGen.ts`:

> `tools`/`allowedTools` only restrict Claude Code's **own built-in** tools — they do **not** restrict MCP-server tools inherited via `settingSources`. Confirmed directly: with only `tools: ["WebFetch", "Skill"]` set and no `canUseTool`, a real generation call invoked `mcp__claude_ai_Google_Drive__create_file`, attempting to write the resume into the user's actual Google Drive — completely unrelated to this narrow-purpose session and never something it should be able to reach.

So every feature module implements its own **default-deny allowlist** `canUseTool`, rather than trying to "blocklist" every known MCP server — because any MCP integration the user adds later would otherwise be silently exposed to these narrow-purpose sessions if the approach weren't default-deny. See the last column of the table above for each module's exact scope.

### 5.4 The skills-allowlist mechanism

`skills: string[]` is an SDK option that scopes a session to only "see" and be able to invoke, via the `Skill` tool, the specific skills listed — not "the user's global `~/.claude/skills`" or "Claude Code's bundled skills," but precisely the ones under this app's own `.claude/skills/` that are relevant to the current task. `STARQ_SKILLS`/`RESUME_GEN_SKILLS` are the constants listing what each module needs; `assistant.ts` doesn't set this option at all, since its whole job is managing the `.claude/skills/` directory and it needs to discover every skill.

The `/api/assistant/mentionables` route is a **completely separate** mechanism: it walks the `.claude/skills/` directory on disk directly (supporting both the `<name>/SKILL.md` directory layout and the flat `<name>.md` layout) to populate the floating assistant's `@` autocomplete list — unrelated to the SDK's `skills` allowlist above except that they happen to read the same directory.

## 6. Typst Compiling: Why Both a Client and a Server Version Exist

| | Client-side (`src/lib/typstClient.ts`) | Server-side (`src/lib/agent/typstServerCompile.ts`) |
|---|---|---|
| Runtime | Browser (`"use client"`) | Node (inside API routes) |
| wasm source | Static files `/typst/*.wasm` (copied into `public/typst/` by `postinstall`) | Read directly from `node_modules/@myriaddreamin/...` on disk |
| `@preview/...` package resolution | Via `TypstSnippet.fetchPackageRegistry()`, using the browser's native `fetch` | Via a **synchronous** call to `curl` through `execFileSync` — see reasoning below |
| Used for | Live preview in `TypstPreview` on `/generate`, `/templates`, `/resumes`; client-triggered PDF download/upload | The `autoConverge.ts` convergence loop, `templateCalibration.ts`'s template analysis, the `/api/resume/generate` route — all of which run in API routes with no browser/DOM, and need programmatic page-count/fill-ratio measurements |

**Why server-side package resolution uses a synchronous `curl` instead of `fetch`**: per the source comment — the Typst compiler's `PackageRegistry.resolve` callback is invoked **synchronously** from inside the wasm module, and native `fetch` is always asynchronous, so it can't be plugged directly into that synchronous callback. The fallback is `execFileSync` running a `curl` subprocess.

The server-side compiler also exposes a few measurement functions the client-side one doesn't have:
- `countBodyChars`: a character-count proxy used for capacity calibration;
- `insertAutoHeightOverride` + `measureAutoHeight`: splices `#set page(height: auto)` in right after a template's own declarations, ignoring the normal page-break limit, to measure how tall the content **actually** needs to be (even if it's already overflowing the real one-page limit);
- `measureRealPageHeight`: compiles the template once with near-empty placeholder content, at the template's real paper settings, to derive the true page height in points — since something like `paper: "us-letter"` is opaque at the source-text level when it's just an argument passed into an imported package function.

## 7. PDF Storage

`src/app/api/resumes/[id]/pdf/route.ts`:

- `PUT`: accepts the raw PDF bytes already compiled client-side (`ArrayBuffer`), writes them to `storage/resumes/<id>.pdf`, and records that absolute path in `GeneratedResume.pdfPath`.
- `GET`: reads the file by `pdfPath` and streams it back as `application/pdf`, with the `Content-Disposition` filename hardcoded to `"resume.pdf"` — because that header's `filename=` value must be Latin-1/ByteString, and a Chinese label can't go there directly.
- Deleting a saved resume best-effort `unlink`s the corresponding PDF file (failure there doesn't block deleting the database record).

## 8. The Auto-Convergence Algorithm (`src/lib/agent/autoConverge.ts`)

**Constants**: `MAX_AUTO_ROUNDS = 3` (up to 3 additional corrective rounds beyond the first), `MIN_FILL_RATIO = 0.9` (the convergence floor), `TARGET_FILL_RATIO = 0.95` (the correction target, deliberately a bit above the floor so a correction doesn't land right on the boundary).

**How each round is scored** (`checkFit` → `distanceToConverged`):

1. Compile the source for real on the server to get `pageCount`;
2. Use `measureAutoHeight` to measure how tall the content needs to be with page breaks disabled, then divide by the real page height to get `fillRatio` (this can exceed 1, quantifying how far over the limit it is);
3. Use `countBodyChars` to count the body character count.

Scoring rule (lower is better): any `pageCount !== 1` scores badly (`1000 + pageCount` — more overflow pages score worse); single page but `fillRatio` unknown scores `500`; single page with `fillRatio >= 0.9` scores `0` (converged); single page but underfull scores `0.9 - fillRatio` (closer to 0.9 is better). **Any single-page result always beats any overflowing result.**

**The loop itself** (`runConvergenceLoop`): starting from the first round's result, as long as it hasn't converged, rounds remain, and the previous round didn't error out, it:

- Sends a "please shorten to one page" or "please fill the empty space" corrective message to the *same* session (continued via `resume: sessionId`), depending on whether the issue is overflow or underfill — each including a target character count computed from **that round's own** data (`charCount / fillRatio * TARGET_FILL_RATIO` — the logic being "if this many characters produced this fill ratio, roughly how many characters would be needed to reach exactly 100%");
- Records the new round's result and score, and checks convergence again.

**Which round is finally used**: whichever round has the lowest score across all of them — **not simply the last round** — since a correction can overshoot (e.g. compressing too aggressively to fit one page, or overflowing to a second page while trying to fill space), so the scores are explicitly compared. The frontend shows every round as a chat message (non-first rounds prefixed "自动调整："/"Auto-adjustment:"), so you can see the intermediate process even when the final one used isn't the last message shown.

`charRange.ts`'s `estimateTargetCharCount` is a separate mechanism, used only once, **before** generation, when building the very first prompt — based on the template's historical calibration range (the midpoint of `{charRangeLow, charRangeHigh}`, or extrapolated by a 1.15/0.85 factor if only one bound is known). It's entirely independent from the "compute fresh from this round's actual data" logic above — don't conflate the two.

## 9. Template Calibration and Sanitization

- **Calibration** (`templateCalibration.ts`): `analyzeTemplate` runs one **real** generation + convergence pass against built-in, fairly rich fake data (`FAKE_PERSONAL_INFO`/`FAKE_EXPERIENCES`/`FAKE_JD`), feeds every round's real measured `(charCount, fillRatio, pageCount)` into `charRange.ts`'s `narrowRange` (not just the last round), progressively narrowing the estimated range of "how much text fits on one page" for this template, and stores it together with the once-measured `realPageHeightPt` into `ResumeTemplate.calibration`. Re-running "Analyze" narrows the existing range further rather than resetting from scratch each time.
- **Sanitization** (`templateSanitize.ts`): before a template's source ever reaches the generation prompt, a regex pass mechanically replaces `#let <name> = "..."`-style variable bindings — whose lowercased name matches a known personal-info pattern (`name/fullname/author`, `email/mail`, `phone/tel/mobile`, `location/address`, `github`, `linkedin`, `website/homepage/portfolio/twitter`) — with the currently logged-in user's actual personal info (or blank). The reason this exists: users often start from a template that already has someone else's real info baked in, and "relying on the model to always remember to swap those out" proved unreliable in testing — so this deterministic mechanical safety net was added rather than depending entirely on the prompt.

## 10. Unsaved-Changes Detection Mechanism

Full implementation in `src/lib/unsavedChanges.tsx`.

**Overall design**: there is exactly **one** global `UnsavedChangesContext` (`{isDirty, setDirty}`), rather than each page keeping its own — the reasoning, per the source comment, is that "only one page is ever mounted at a time (plain route navigation unmounts the previous one), so a single shared flag is enough."

**How a page reports "dirty" state**: each page computes its own `isDirty` boolean and reports it via `useReportDirty(isDirty)` — internally a `useEffect` that calls `setDirty(isDirty)` on change, and **unconditionally calls `setDirty(false)` on unmount** (so leaving a page always clears the flag, even if the page forgot to itself).

**How each of the four pages computes `isDirty` (the shape isn't uniform — it depends on that page's state shape)**:

| Page | How it's computed |
|---|---|
| `/generate` | `typstSource !== "" && typstSource !== savedTypstSnapshot` — a plain string comparison against a saved snapshot, with an explicit guard against the initial empty-string state counting as a false positive |
| `/templates` | `name !== savedSnapshot.name \|\| source !== savedSnapshot.source` — field-by-field comparison against a `{name, source}` snapshot object |
| `/profile` | `!loading && JSON.stringify(profile) !== JSON.stringify(savedSnapshot)` — whole-object JSON-string comparison, gated on `!loading` to prevent a false positive before the initial fetch completes |
| `/experience` | `JSON.stringify(current) !== JSON.stringify(savedSnapshot)` — same whole-object JSON comparison pattern as `/profile` |

**The actual interception happens in two layers**:

1. **Full page reload / close / address-bar navigation**: `UnsavedChangesProvider` attaches a real `window.addEventListener("beforeunload", ...)` — if `isDirty`, it calls `e.preventDefault()` and sets `e.returnValue = ""` (the browser shows its own standard confirmation dialog; the actual wording is controlled by the browser, not by the string passed here — Chrome just requires `returnValue` to be assigned something).
2. **In-app client-side route navigation**: **not** intercepted at the router level (there's no wrapped `router.push`, no Next.js navigation-guard hook). Instead it's a plain "context + `confirm()`" pattern — `NavBar.tsx`'s `go(href)` function reads `isDirty` from `useUnsavedChanges()` before actually calling `router.push(href)`, and if it's true, calls `confirm(UNSAVED_CHANGES_MESSAGE)`; if the user cancels, it just `return`s without navigating. This **only covers navigation triggered through `NavBar`'s own buttons** (though in practice `NavBar` is the app's only navigation surface). Individual pages also manually `confirm()` the same message string before their own in-page "dangerous" actions (switching to a different template/experience, starting a fresh generation) — that's a local reuse of the same pattern, not something that fires automatically.

`UNSAVED_CHANGES_MESSAGE` is a hardcoded Chinese string: `"有未保存的修改，离开后将会丢失，确定要离开吗？"` ("There are unsaved changes that will be lost if you leave — are you sure?").

## 11. Other Notable Mechanisms

**Session ID storage: database column vs. localStorage** — `Experience.sessionId` and `GeneratedResume.sessionId` are both stored as database columns, because those two chats are each tied to a specific, permanent data row (a specific experience's distillation chat, or a specific generated resume's tailoring chat) that should be resumable at any time as long as that row exists. The floating assistant is the opposite — it isn't tied to any one piece of data, it's a single cross-page global utility — so its `{sessionId, messages}` live in browser `localStorage` (key: `resume-agent:assistant-drawer`), with a separate `resume-agent:assistant-drawer-y` key just recording its dragged vertical position.

**Typst syntax highlighting** (`src/lib/typstLanguage.ts`) — explicitly a lightweight hand-written tokenizer, not a full grammar: built on `@codemirror/language`'s `StreamLanguage.define`, with state tracking only one flag ("currently inside a block comment"). It recognizes: block/line comments, `=`-prefixed headings at the start of a line, string literals, `$...$` inline math (deliberately no nested-`$` handling), `` `code` `` raw spans, `<label>` references, `@citation` references, `#` (code-mode entry, tagged as a keyword), numeric literals with Typst unit suffixes (`pt/em/cm/mm/in/fr/deg/rad/%`), a fixed keyword set (`let/set/show/import/include/if/else/for/while/return/break/continue/in/not/and/or/none/auto/true/false/as/context`), and `*bold*`/`_emphasis_` markup spans. The source's own comment admits it's "not a full grammar, just enough to make the template editor readable."

**Dark mode detection** (`src/lib/useIsDarkMode.ts`) — purely media-query based: `window.matchMedia("(prefers-color-scheme: dark)")`, read once on mount and kept in sync via a `change` listener; there's **no** manual toggle, and no class is added/removed on `<html>`. Places that can't conveniently use Tailwind's `dark:` variant (`TypstPreview`, the CodeMirror instances) use this hook's boolean directly to choose a theme; other ordinary elements still use Tailwind's own `dark:` variant (also following `prefers-color-scheme`, with no `next-themes`-style library involved).

**Error-handling convention**:
- Server: `src/lib/apiError.ts`'s `errorResponse(err)` — a `ZodError` becomes `{error: "Invalid request", issues}` with status 400; anything else becomes `{error: message}` with status 500 — guaranteeing API routes always return valid JSON on failure instead of letting Next.js's default HTML/empty error response reach the frontend.
- Client: `src/lib/apiClient.ts`'s `parseJsonResponse` reads the response as text first, then `JSON.parse`s it, throwing a catchable `ApiError` if parsing fails or `!res.ok` (preferring the server's `error` field as the message when present). Every `apiGet/apiPost/apiPut/apiDelete/apiPutBinary` call funnels through this, so callers can uniformly check `err instanceof ApiError` to distinguish an "expected" business error.

## 12. Testing and Deployment

- **No test framework is configured at all** (no jest/vitest/playwright, no `*.test.ts` files); `package.json`'s `scripts` only has `dev/build/start/lint/postinstall`.
- Deployment shape: local `next dev` (development) or `next build && next start` (production mode, but still a single local process) — not designed for multi-user/cloud deployment. There's no auth and no per-user data isolation.
- Also published as a global npm package (`npm install -g resume-agent`) — see §13 below for how that packaging works.

## 13. npm CLI Packaging

`resume-agent` is also distributed as a self-contained CLI via npm, on top of the same source. Key pieces:

- **`bin/resume-agent.js`** (referenced by `package.json`'s `bin` field) is the entry point npm links onto `PATH`. On every launch it: resolves/creates `~/.resume-agent/` (with `~/.resume-agent/storage/resumes/` inside it), sets `DATABASE_URL` and `RESUME_STORAGE_DIR` env vars to point there, checks whether migrations need to run (see next bullet), then spawns `next start` against the package's bundled `.next` build and opens the default browser.
- **Migration check is skipped when nothing changed, via a marker file** (`~/.resume-agent/.last-migration`) — not unconditionally on every launch. `prisma migrate deploy` itself is safe to run repeatedly (it only ever applies migrations not already recorded as applied, never drops/resets/diffs anything — the same command CI/CD pipelines run on every deploy, so it cannot cause data loss on its own), but spawning the Prisma CLI, loading its bundle, connecting, and diffing the migrations table takes real time on every single launch even when there's nothing to apply — noticeably slow for what should be an instant local app start. `latestMigrationName()` reads `prisma/migrations/`'s latest folder name directly (no subprocess needed) and compares it against the marker; if they match, `runMigrations()` returns immediately. The marker is keyed on the actual migrations directory contents (not just "have we ever migrated"), so a newer `resume-agent` version that ships new migrations is still picked up automatically, and it's only ever written *after* `migrate deploy` exits successfully, so a failed or interrupted run can never leave the marker claiming a migration was applied when it wasn't. (Known residual edge case, not currently handled: if a user manually replaces `~/.resume-agent/dev.db` with an older backup, the marker would still claim "up to date" even though the swapped-in DB might be behind — an acceptable trade-off for a single-user local tool, not solved for here.)
- **Why the spawned server's `cwd` is pinned to the package root**: `next start <dir>` does *not* `process.chdir()` — it only resolves build artifacts relative to `<dir>`. Without explicitly setting `cwd: PACKAGE_ROOT` on the spawned process, the server would inherit whatever directory the user happened to invoke `resume-agent` from, and `src/lib/agent/core.ts`'s `PROJECT_ROOT = process.cwd()` would then resolve to the wrong place — silently failing to find `.claude/CLAUDE.md`/`.claude/skills/` (no crash, just every AI feature losing its behavioral customization). This was an actual bug caught after first publishing v0.1.0; the fix is the `cwd` option on the `spawn()` call in `bin/resume-agent.js`.
- **`RESUME_STORAGE_DIR`**: `src/app/api/resumes/[id]/pdf/route.ts`'s `STORAGE_DIR` reads this env var (falling back to the old `process.cwd()`-relative path for local `npm run dev`), so saved PDFs land in the fixed `~/.resume-agent/` data directory regardless of invocation directory — this also had to be retrofitted after the same v0.1.0 publish, for the same underlying reason (the route was written assuming `cwd` == repo root, which stopped being a safe assumption once the app could run as an installed CLI from anywhere).
- **`package.json`'s `files` field** controls exactly what ships in the tarball: `bin`, a *production* `.next` build (explicitly excluding `.next/dev` and `.next/cache` — see the packaging-bloat note below), `prisma` (migrations + schema), `public` (Typst wasm binaries), `scripts`, the generated `src/generated/prisma` client, and `.claude/CLAUDE.md` + `.claude/skills` (but deliberately *not* `.claude/settings.json`, which is a repo-local worktree-isolation dev setting with no meaning for an end user).
- **`prepublishOnly`: `rm -rf .next && next build && prisma generate`** — guarantees a clean production build and a freshly generated Prisma Client on every publish, so a stale local `.next` (e.g. containing leftover `next dev`/Turbopack cache from local development) can never leak into a published tarball. This was added after an initial `npm pack` produced a **336 MB** tarball — `.next/dev/cache` (Turbopack's persistent dev cache) alone accounted for ~407 MB of the ~530 MB uncompressed contents; excluding `.next/dev` and `.next/cache` via the `files` field brought `.next`'s real contribution down to ~22 MB (the actual `.next/server`/`.next/static`/`.next/build` production output).
- **`prisma.config.ts` must be published too, and explicitly pointed at**: this project's `datasource db { }` block in `schema.prisma` deliberately has no `url` — under Prisma 7, the datasource URL is supplied exclusively via `prisma.config.ts`'s `defineConfig({ datasource: { url: env("DATABASE_URL") } })`. `prisma.config.ts` lives at the repo root, outside every directory the `files` field originally listed, so v0.1.0 shipped without it at all — `prisma migrate deploy` failed everywhere (not OS-specific) with `The datasource.url property is required in your Prisma config file`. Fixed by adding `prisma.config.ts` to `files`, and by having `bin/resume-agent.js` pass `--config <absolute path>` explicitly to the `migrate deploy` subprocess instead of relying on Prisma's cwd-based auto-discovery of the config file.
- **`npm` unconditionally strips any directory literally named `node_modules`, anywhere in the package — regardless of `files`.** Next.js 16 defaults to Turbopack for both `next dev` and `next build`. Turbopack's production build traces certain dependencies that can't be bundled into a JS chunk (native addons like `better-sqlite3`, and `@prisma/client`) and physically copies each one into `.next/node_modules/<content-hash>/`, with the compiled server chunks `require()`-ing them by that hashed name (relying on Node's ordinary `node_modules`-resolution walk finding that directory as an ancestor of the requiring chunk). Since `files` can't override npm's hardcoded `node_modules` exclusion, `.next/node_modules` silently vanished from every published tarball regardless of what `files` said, and the server crashed on the first request that touched the database with `Cannot find module '<hashed-name>'` — again on every OS, first caught via a Windows user's report.
  - **Root-cause fix**: `prepublishOnly` now builds with `next build --webpack` (Next 16 still ships webpack as an explicit opt-out — `--webpack` — from the new Turbopack default). Next's own `serverExternalPackages` docs describe the intended behavior for packages like `better-sqlite3`/`@prisma/client` as a plain, unhashed native `require()` resolved against the real `node_modules` — which is what classic webpack has always done for this feature; the hashed vendor-copy behavior appears to be Turbopack-specific machinery, not something `serverExternalPackages` itself mandates. This has not been empirically verified end-to-end in this environment (no local Node available while the fix was made) — verify with a real `rm -rf .next && npm run build` (using the `--webpack` variant) before trusting it in place of the fallback below.
  - **Defensive fallback kept in place**: `scripts/relocate-next-native-deps.mjs` (renames `.next/node_modules` → `.next/vendor` post-build, a name npm won't strip) and `bin/resume-agent.js`'s `ensureNativeVendorModules()` (renames it back on the end user's machine before starting the server) are both written to be no-ops if `.next/node_modules` doesn't exist after the build — so if `--webpack` does eliminate the hashed vendor-copy entirely, this whole mechanism silently does nothing and can eventually be deleted; if it doesn't (or some other traced dependency triggers the same behavior in the future), the fallback still protects the publish.

## 14. Known Technical Debt / Things to Watch

- `serialize()` (the JSON-field deserialization helper) is duplicated separately in `src/app/api/resumes/route.ts` and `src/app/api/resumes/[id]/route.ts`, rather than factored into a shared module.
- `ResumeTemplate.calibration`'s schema comment describes a shape (`{intercept, perEntry, perBullet, perChar, ...}`) that doesn't match what's actually written (`{charRangeLow, charRangeHigh, realPageHeightPt, calibratedAt}`) — the comment looks like an earlier design that was never updated.
- The same `sessionId` could in theory be resumed by two concurrent requests (e.g. a user double-clicking "Regenerate" quickly) — there's no mutex protection in code. Low probability in a single-user context, but not impossible.
