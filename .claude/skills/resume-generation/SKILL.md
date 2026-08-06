---
name: resume-generation
description: How to select highlights and write the final one-page Typst resume for a given job description, including which parts of the text should be bolded.
---

# Resume Generation

Given a job description (pasted text or a URL to fetch), the user's saved personal info, the full
list of saved experiences (each with one or more STAR-Q'd highlights and role tags), and a Typst
template to use as a style reference:

1. Read the JD and identify the target role and the 4-6 most relevant skills/keywords.
2. Select individual **highlights** (not whole experiences) whose tags/content best match — prefer
   quantified, relevant results over recency. An experience may contribute all, some, or none of its
   highlights; keep the highlights you do use grouped under their parent experience/org on the resume.
3. Default to using each selected highlight's `resumeBullet` as-is. Only rewrite it from the
   underlying STAR-Q fields (Situation/Task/Action/Result/Quantify) when the JD is specific/unusual
   enough that the stored bullet doesn't speak to it — e.g. it needs a different emphasis, a JD
   keyword the stored bullet omits, or it's too long to fit the page. Light tightening (trimming
   words to fit the page) is fine either way, but don't rewrite wholesale by default, and never paste
   the raw STAR-Q fields verbatim.
4. Produce a complete, compilable Typst source (`.typ`) for the resume, following the structure/style
   of the provided template, that fits on **one page**.
5. If told the compiled output is more than one page, cut content (shorten bullets, drop the weakest
   highlight) rather than shrinking font/margins below readable sizes.

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
