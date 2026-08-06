---
name: resume-highlight-extraction
description: Extract resume-worthy highlights from a person's raw experience (work logs, project diaries, brain-dumps, interview transcripts, messy notes). Use this whenever the user wants help turning an experience, project, internship, or work history into resume bullets, wants to "find the highlights" in something they did, or asks how to make an experience sound more impressive without fabricating anything. Also use when the user has a long, unstructured document (diary, notes, chat log) and wants the valuable/impressive parts pulled out — not just for resumes, but for the underlying skill of finding what's genuinely notable in a pile of raw experience. Push through even if the source material looks mundane or the person is unsure anything in it is worth mentioning — that undervaluing is exactly the failure mode this skill corrects for.
---

# Resume Highlight Extraction

Turns raw, unstructured experience (diaries, logs, brain-dumps, transcripts) into
resume-ready bullets — without inventing facts. The core problem this skill solves:
people systematically undervalue their own work because they were inside it. The
job is to surface what's actually notable, quantify it honestly, and never let the
person (or the writer) round a claim up past what actually happened.

## The core loop

1. **Read everything first, broad.** Don't start narrowing until you've seen the
   whole source. Early narrowing means missing the best material, which is often
   buried in a throwaway sentence the person didn't think was important.
2. **Surface candidates in a wide list, grouped by theme**, before drafting any
   bullets. Show your work — let the person see the full candidate set and react,
   rather than silently picking "the best ones" for them. They often have context
   you don't (what's true, what's overstated, what they actually did vs. what a
   teammate did).
3. **Ask which threads matter**, don't assume. Target role/audience changes which
   highlights are worth deep-diving. Use a light preference check (a couple of
   quick-pick questions) rather than open-ended "what do you want to focus on?" —
   it's faster for the person to react to options than generate them from scratch.
4. **Deep-dive each candidate with STAR-Q** (below), one at a time, explicitly
   flagging what's missing rather than filling gaps yourself.
5. **Draft the bullet, verify with the person, then move to the next.** Follow
   `resume-bullet-writing` for how to phrase it. Never batch-draft final bullets
   before the underlying facts are confirmed — an impressive-sounding bullet
   built on an assumption is worse than a modest one built on fact, because it
   will collapse under an interview follow-up question.
6. **Export/format last**, once the person has reacted to the drafts.

## Five lenses for finding highlights in raw material

When scanning a diary/log/transcript, most people describe *what happened*
without noticing what makes it notable. Look through these lenses — they surface
different kinds of value:

- **Contrast (before vs. after)**: What was true before this action, and what
  changed? The size of the gap is the size of the highlight. Ask: "if you hadn't
  done this, what would have happened?" — the more negative the counterfactual,
  the stronger the highlight.
- **Constraints**: What made this harder than it looks? Tight deadline, missing
  information, understaffed, competing stakeholders, no prior playbook. Constraints
  overcome are often more impressive than the raw outcome.
- **Scale**: How many people/users/dollars/systems did this touch? People routinely
  forget to mention scale because it's just "the number of users we have," not
  something they think to flag.
- **Ownership**: Was this something the person *found* or *decided*, versus
  something they were told to do? "Proactively identified X" (found it themselves,
  often before it became a problem) is a materially different claim from
  "was assigned to fix X" — and a much stronger one. Get this distinction right;
  don't let ownership drift upward during drafting.
- **Incident/surprise**: Anything that went wrong and required a real-time
  response (a bug, an outage, a conflict, a surprising result) tends to make the
  best interview stories because it shows judgment under pressure, not just
  execution.

Don't stop at the first highlight found in a section — the strongest material is
often two or three sentences past the obvious one.

## STAR-Q: the extraction unit

Standard STAR, plus a Q step that STAR alone tends to skip:

- **S — Situation**: One sentence of context. What was true before, what was the
  setup.
- **T — Task**: What was this person's actual responsibility or goal here
  (distinct from what the team's goal was)?
- **A — Action**: What did they specifically do? Use strong, precise verbs (led,
  designed, diagnosed, migrated) — not vague ones (helped with, worked on,
  participated in); see `resume-bullet-writing` for verb choice. If the source
  material is vague about the verb, ask; don't guess a stronger one than what
  happened.
- **R — Result**: What changed because of the action? Prefer outcomes over
  activities ("balance errors eliminated," not "wrote code").
- **Q — Quantify**: Push for a number — scale, time, percentage, dollar amount,
  count. If no number exists, either:
  - ask the person to estimate (and label it as an estimate), or
  - fall back to a clear causal chain instead of a fabricated number. A precise
    mechanism ("QA can now see coverage directly from generated test cases,
    instead of reconstructing it manually") is more credible than an invented
    statistic, and safer.

**Never invent Q.** An estimated number, clearly obtained by asking the person,
is fine. A number that sounds plausible but wasn't confirmed is not — it's the
single most common way these bullets fall apart at interview.

## Verification discipline (this is the part people skip)

This is what separates a genuinely useful highlight-extraction pass from a
generic "make my experience sound impressive" rewrite:

- **Flag every unconfirmed claim explicitly**, inline, as you draft — don't
  silently smooth over gaps. Use a visible marker (e.g. `[TO CONFIRM]`) so the
  person can't miss it.
- **Distinguish ownership levels precisely** and ask when unclear: solo-designed
  100%? Found the issue but someone else implemented the fix? Was this an assigned
  ticket or something proactively discovered? These are different bullets, not
  stylistic variations of the same one.
- **Distinguish "fixed" from "identified and proposed a fix for."** If a fix
  hasn't shipped, the bullet must say so. This will get caught in an interview
  otherwise, and it undermines every other bullet's credibility.
- **Keep scope claims bounded to what's true.** "5,000 sensitive records found in
  internal logs" is very different from "5,000 users' data was leaked publicly" —
  don't let the more dramatic version leak in during drafting, even if it reads
  better. If the person's original material draws a boundary (internal-only, no
  external exposure, no confirmed attack), preserve that boundary in the bullet.
- **When the person offers a technical justification** (e.g., "why I chose X over
  Y"), capture it — this is exactly the material that makes an interview answer
  strong, even if it's too much detail for the bullet itself. Note it as
  interview prep material alongside the bullet.

## Output format

For each highlight, produce: [Highlight name], STAR-Q and Resume bullet.
After all highlights are drafted, add:

- **An "info still needed" table** — a compact list of every `[TO CONFIRM]` left
  open, so the person can close the gaps in one pass instead of hunting through
  the doc.
- **A suggested priority ranking**, tied to the target role/audience if known.
  Rank by: independence/ownership > technical depth > quantified impact >
  breadth. Don't just list in source order — actually rank.

## Common failure modes to avoid

- Drafting polished bullets before facts are confirmed (produces bullets that
  need to be redone, and normalizes skipping verification).
- Narrowing to "the 3 best highlights" too early, before the person has seen the
  full candidate set — they may value a different one than you'd guess.
- Rounding "found it during review, not yet fixed" up to "fixed."
- Inventing a plausible-sounding metric instead of asking or falling back to a
  causal-chain description.
- Treating every highlight as equally strong — the ranking step at the end is not
  optional, it's what makes the output usable under a 3-5-bullet resume limit.

## When the source material seems mundane

If the person is unsure their experience contains anything notable, run the five
lenses anyway before concluding there's nothing there — ownership and constraints
in particular surface value in work that looks routine on the surface (e.g., "I
just followed the existing process" often hides "I noticed the existing process
had a gap and patched around it," which is a real highlight).
