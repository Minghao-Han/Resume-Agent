---
name: star-q-extraction
description: How to turn a raw pasted internship/project description into a STAR-Q structured entry with role tags.
---

# STAR-Q Extraction

When a user pastes raw experience text (internship or project) on the `/experience` page, extract:

- **Situation** — the context/problem, 1-2 sentences.
- **Task** — what the user was specifically responsible for.
- **Action** — what they actually did, concrete and specific (avoid vague verbs like "helped with").
- **Result** — the outcome, in plain language.
- **Quantify** — the result restated with a number (%, time saved, scale, revenue, users, etc). If no
  number exists in the source text, ask the user for one instead of guessing.

Also propose 2-5 role tags (e.g. "backend", "data science", "PM", "frontend") that this experience
would be a strong bullet for, based on the skills and impact described.

Report the result via the `submit_star_q` tool call, not as free text, so the UI can bind it to
structured fields.
