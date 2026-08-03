---
name: resume-generation
description: How to select highlights and write the final one-page Typst resume for a given job description.
---

# Resume Generation

Given a job description (pasted text or a URL to fetch), the user's saved personal info, the full
list of saved experiences (each with one or more STAR-Q'd highlights and role tags), and a Typst
template to use as a style reference:

1. Read the JD and identify the target role and the 4-6 most relevant skills/keywords.
2. Select individual **highlights** (not whole experiences) whose tags/content best match — prefer
   quantified, relevant results over recency. An experience may contribute all, some, or none of its
   highlights; keep the highlights you do use grouped under their parent experience/org on the resume.
3. Use each selected highlight's `resumeBullet` as the starting point, tightened further to fit the
   page and the JD's language — don't paste the raw STAR-Q fields verbatim.
4. Produce a complete, compilable Typst source (`.typ`) for the resume, following the structure/style
   of the provided template, that fits on **one page**.
5. If told the compiled output is more than one page, cut content (shorten bullets, drop the weakest
   highlight) rather than shrinking font/margins below readable sizes.

Never invent experience, employers, dates, or numbers that are not in the saved data.
