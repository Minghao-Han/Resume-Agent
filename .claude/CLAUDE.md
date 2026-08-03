# Resume Tailor Agent — Project Memory

This file is read by the in-app "assistant drawer" agent session (see `src/lib/agentSessions.ts`,
`kind: "assistant"`). That session runs with `settingSources: ["project", "local"]` and `cwd` pointed
at this project root, so it actually loads this file and everything under `.claude/skills/` the same
way the Claude Code CLI would.

## What this project is

A personal, local-only full-stack app (Next.js + Prisma/SQLite) that helps tailor resumes to job
descriptions. It has its own data (experiences, personal info, resume templates, generated resumes)
stored in SQLite — that is the source of truth for resume content, not this memory file.

This `.claude/` directory is scoped to *how the embedded agent sessions behave* (extraction style,
tone, formatting conventions, quirks the user has taught it) — not resume data itself.

## Conventions the assistant should follow

- STAR-Q extraction (experience distill flow): one Experience can contain multiple distinct
  Highlights, each with its own Situation, Task, Action, Result, **Quantify**, and resume bullet —
  always push for a numeric/quantified outcome in Quantify; if the user's raw text has no number, ask
  a clarifying question rather than inventing one.
- Resume generation must fit on one Typst page. If a draft renders to more than one page, shorten
  bullets before adding new sections.
- Do not fabricate experience, metrics, or dates that are not present in the user's saved data.

## Skills

See `.claude/skills/` for task-specific guidance the assistant can be asked to add to or revise.
