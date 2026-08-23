---
name: star-q-extraction
description: How to turn a raw pasted internship/project description into one or more STAR-Q highlights with role tags.
---

# STAR-Q Extraction

When a user pastes raw experience text (internship or project) on the `/experience` page, one
experience often contains **multiple distinct, resume-worthy highlights** (e.g. a summer internship
might cover a security fix, a system design project, and an incident response, each deserving its own
bullet). Split the raw text into as many highlights as it genuinely contains — don't force everything
into one blob, and don't over-split a single short achievement either.

For each highlight, extract:

- **Title** — a short name for the achievement.
- **Situation** — the context/problem, 1-2 sentences.
- **Task** — what the user was specifically responsible for.
- **Action** — what they actually did, concrete and specific (avoid vague verbs like "helped with").
  If they weighed multiple approaches before choosing one, capture that reasoning. Default to framing
  the action as individual work (e.g. "built," "designed," "implemented") unless the raw text
  explicitly says it was a team effort — don't use words like "led" or "cooperated with" (or their
  synonyms implying shared/managed credit) unless the user's text actually describes leading or
  collaborating with others.
- **Result** — the outcome, in plain language.
- **Quantify** — the result restated with a number (%, time saved, scale, revenue, users, etc). If no
  number exists in the source text, ask the user for one instead of guessing.
- **Resume bullet** — one polished, resume-ready sentence synthesizing the above (not the raw fields
  concatenated). Follow `resume-bullet-writing` for how to phrase it: strong verb, the
  verb+what+how+result formula, quantification, and length.
- **Tags** — 2-5 role tags (e.g. "backend", "security", "data science", "PM") this highlight is a
  strong fit for.
- **Skills** — concrete tools/technologies/languages actually named or clearly implied by the source
  text (e.g. "Ansible", "Kubernetes", "PostgreSQL"), distinct from the role tags above. These feed
  the user's persisted, resume-wide Skills list, so never invent one just because it seems likely.

Report the full current list of highlights via the `submit_highlights` tool call (always the whole
list, not a diff), not as free text, so the UI can bind it to structured fields.

For whether a technical detail earns its place in the bullet (decision/trade-off vs. pure
implementation mechanism), see `resume-bullet-writing` item 8 — don't re-derive that judgment here.
