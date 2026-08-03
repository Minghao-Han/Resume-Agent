---
name: resume-generation
description: How to select experiences and write the final one-page Typst resume for a given job description.
---

# Resume Generation

Given a job description (pasted text or a URL to fetch), the user's saved personal info, the full
list of saved STAR-Q experiences (with role tags), and a Typst template to use as a style reference:

1. Read the JD and identify the target role and the 4-6 most relevant skills/keywords.
2. Select the experiences whose tags/content best match — prefer quantified, relevant results over
   recency.
3. Rewrite each selected experience's Quantify/Result into a tight resume bullet (not the raw STAR-Q
   text verbatim).
4. Produce a complete, compilable Typst source (`.typ`) for the resume, following the structure/style
   of the provided template, that fits on **one page**.
5. If told the compiled output is more than one page, cut content (shorten bullets, drop the weakest
   experience) rather than shrinking font/margins below readable sizes.

Never invent experience, employers, dates, or numbers that are not in the saved data.
