---
name: resume-generation
description: How to select highlights and write the final one-page Typst resume for a given job description, including which parts of the text should be bolded.
---

# Resume Generation

Given a job description (pasted text or a URL to fetch), the user's saved personal info, the full
list of saved experiences (each with one or more STAR-Q'd highlights and role tags), and a Typst
template to use as a style reference:

1. Read the JD and identify the target role and the 4-6 most relevant skills/keywords.
2. **CRITICAL, non-negotiable ranking rule: work experience (internships/jobs) always outranks
   personal/school projects, unless a project is the ONLY source that covers a specific JD
   requirement.** Apply this as an actual two-pass procedure, not a vague preference:
   - **Pass 1**: build your candidate pool from every work-experience highlight whose tags/content
     match the JD, ranked by relevance. This pool gets first claim on page space.
   - **Pass 2**: only pull in project highlights to (a) fill genuinely leftover space after the work
     pool is exhausted, or (b) cover a specific JD requirement/keyword that no work-experience
     highlight speaks to at all.
   - **Before finalizing your selection, explicitly re-check**: for every project highlight you're
     about to include, is there an unused work-experience highlight that matches the same JD
     requirement equally or better? If yes, swap it in and drop (or shorten) the project highlight
     instead. A JD keyword that literally appears in a work-experience highlight's tags/content
     (e.g. JD says "service discovery" and a work highlight is tagged "service discovery" or its
     text mentions it directly) must not lose out to a project highlight on a vaguer or partial match.
   - Recency and "how impressive it sounds" do NOT override this ranking — a less flashy but
     JD-relevant work highlight still beats a flashier project highlight.
3. **CRITICAL, non-negotiable rule: use each selected highlight's `resumeBullet` field verbatim by
   default.** Do not enrich, "improve," or add specificity to it using details pulled from the
   underlying STAR-Q fields (Situation/Task/Action/Result/Quantify) — even if those fields contain
   extra numbers, technical terms, or specifics that would make the bullet read as more impressive
   or detailed. The `resumeBullet` is the already-finalized, user-approved output; the STAR-Q fields
   are your raw material for understanding context, not a second draft to blend in.
   - The ONLY valid reasons to deviate from `resumeBullet` verbatim: (a) it's too long and must be
     shortened to fit the page — trim words, don't rewrite from scratch, and keep the verb/result/
     number intact per `resume-bullet-writing`; (b) the JD needs a specific emphasis or keyword that
     `resumeBullet` genuinely omits AND that emphasis/keyword is not something you can get from a
     different, unused highlight instead — see `resume-bullet-writing` for how to weave a keyword in
     without it reading as bolted on.
   - "This JD is about backend/distributed systems/security/etc." is NOT by itself unusual enough to
     justify a rewrite — most JDs will loosely match the general theme of a highlight. Only rewrite
     when the stored bullet would actively mislead or omit something the JD explicitly asks for.
   - Never paste the raw STAR-Q fields verbatim, and never fabricate new specifics (a technique name,
     a percentage, a response time) that appear nowhere in `resumeBullet` even if they're accurate
     per the underlying fields — if it's not in `resumeBullet`, treat it as off-limits by default.
4. Produce a complete, compilable Typst source (`.typ`) for the resume, following the structure/style
   of the provided template, that fits on **one page**.
5. If told the compiled output is more than one page, cut content (shorten bullets, drop the weakest
   highlight) rather than shrinking font/margins below readable sizes — when cutting, drop project
   highlights before work-experience highlights of similar relevance. Never cut a work-experience
   highlight to keep a lower-relevance project highlight.

Never invent experience, employers, dates, or numbers that are not in the saved data.

## Bold formatting

**Syntax note: this section's own bullets use Markdown's `**double asterisk**` because this file is
Markdown — the resume you're writing is Typst, which bolds with a single asterisk instead:
`*bold text*`. `**text**` in Typst output is not an error, it's just silently not bold (two empty
emphasis toggles around plain text) — always use single asterisks in the generated resume.**

Two tiers, applied with restraint — don't bold by feel.

**Structural (always bold)**: section headings (Experience / Skills / Projects / …), company/school
names, and job titles/degrees. These exist so a reader can scan the resume's skeleton — who, where,
when, what role — in a few seconds.

**In-body, inside bullets (use sparingly)**:

- Bold only two kinds of thing: the quantified result (e.g. "$800," "100 QPS," "15 coupling points")
  and the specific keyword(s) that match the target JD.
- **At most one bolded span per bullet.** Bolding every bullet, or bolding more than one thing in the
  same bullet, defeats the purpose — once everything is bold, bold stops meaning anything and just
  becomes visual noise.
- Never bold a whole sentence or a verb — only the word/number that actually proves the value.

A reader spends only a few seconds to ten-some seconds per resume, mostly scanning for numbers and
keywords — unbolded body text is easy to skim past, but over-bolding (or bolding the wrong thing, like
a verb) is just as bad, since it stops functioning as emphasis once nothing stands out from the rest.
