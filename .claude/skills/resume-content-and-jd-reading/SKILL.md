---
name: resume-content-and-jd-reading
description: Use this when deciding what belongs on a resume versus what should be cut, when the user has a job description (JD) and needs to figure out what it's actually asking for and how to align resume content to it, when selecting which highlights to use for a specific application, or when a drafted resume has leftover space after all content is placed and needs to be filled. Covers content-importance judgment (what recruiters actually weigh vs. what's noise), a repeatable method for reading a JD to extract required vs. nice-to-have signals, tag-based highlight selection per JD (as opposed to a fixed generic ranking), and a tiered approach for filling leftover page space. Pairs with resume-highlight-extraction (produces the candidate pool) and resume-one-page-fitting (fits the final selection onto one page) — this skill sits in between: it decides which candidates make the cut for a specific job.
---

# Resume Content Judgment & JD Reading

Two jobs: (1) judge what content on a resume is actually pulling weight versus
just taking up space, and (2) read a JD systematically so "relevant to this
role" is a defensible judgment, not a guess.

## Part 1 — What content matters

### The core shift: outcome-oriented, not responsibility-oriented

The single biggest lever separating a strong bullet from a weak one is whether
it describes *what the person was responsible for* or *what changed because of
them*. See `resume-bullet-writing` for the full mechanics of this (the
verb+what+how+result formula, quantification, an example) — the relevance to
*this* skill is that outcome-orientation is also a content-judgment signal: a
line that can't be rewritten in outcome terms (Part 2) is usually a cut
candidate, not just a phrasing problem.

### What else reliably matters

- **Industry/role-appropriate vocabulary.** Bullets read as more credible when
  they use the vocabulary insiders at that company/industry actually use for
  that role — this is also part of why JD reading (Part 2) matters: the JD
  tells you which vocabulary the reader is primed to recognize.
- **Recency and relevance drive ordering.** Work experience is generally
  listed in reverse-chronological order, but *within* that constraint, how
  much space each entry gets should scale with how relevant and high-value it
  is to the target role — not just how recent it is.
- **Internal consistency.** After drafting, a self-review pass should check
  for repeated sentence structure/verbs across bullets (a common tell that
  bullets were written all at once as "what happened" rather than each
  independently justified) — see the verb-variety and formatting rules in
  `resume-bullet-writing`. Repetition is often the easiest way to spot which
  bullets still need translating from responsibility to outcome framing.
- **The most job-relevant material goes first** — both at the section level
  (e.g., work experience typically ranks ahead of coursework once a person has
  real experience) and within a section (most relevant/valuable entries or
  bullets get the top position and the most space).

## Part 2 — What to cut

Content earns a cut when it's noise relative to the reader's actual task:
deciding, in a few seconds, whether this person is worth a closer look for
*this* role.
- **Outdated or now-irrelevant experience.** Once someone has 10+ years of
  history, their earliest jobs are usually candidates for compression or
  removal — keep what's recent and relevant, not what's complete.
  Coursework/high-school-level detail should drop off entirely once there's
  real work experience to replace it as evidence.
- **Generic baseline skills.** Skills assumed of any professional in the field
  (e.g., basic Word/Excel for an office role) don't need a line item unless
  the JD explicitly calls them out as a requirement.
- **Activity without outcome.** "Attended weekly status meetings," "responsible
  for X" with no resulting change — if a line can't be rewritten with a result
  attached (Part 1), it's a cut candidate, not a phrasing-fix candidate.
- **Numbers you can't defend in an interview.** A specific stat you can't
  explain the source or methodology of is worse than a qualitative claim
  ("significantly improved") — a defended number outranks an impressive but
  unexplainable one. This connects directly to the verification discipline in
  `resume-highlight-extraction`: never let an unconfirmed number make it this
  far.
- **Redundant skill/course listings** — covered in more depth in
  `resume-one-page-fitting`: a skill or course that's already visibly
  demonstrated in a project/experience bullet doesn't need its own separate
  line.

## Part 3 — How to read a JD

Treat the JD as a spec, not a wish list to skim. The goal is to walk away with
two things: a ranked list of what's actually required, and the vocabulary the
reader will be scanning for.

### Step 1 — Separate required from preferred

JDs almost always mix hard requirements with nice-to-haves, and they're not
always labeled cleanly. Scan for the qualifier attached to each skill/
requirement:

- **Hard requirement signals**: "must," "required," "X+ years of," listed
  under a "Requirements" or "Qualifications" header.
- **Preferred/bonus signals**: "preferred," "a plus," "nice to have," "familiarity
  with," listed under "Preferred," "Bonus," or buried in a general
  responsibilities paragraph rather than a requirements list.

This distinction matters because it tells you where to spend limited resume
space: hard requirements you can genuinely speak to should be unmistakable on
the resume; preferred items are worth including only if there's room and real
substance behind them.

### Step 2 — Extract the recurring/high-weight terms

Skim for words and phrases that repeat across the JD, or that appear in both
the role summary and the requirements section — repetition is a rough proxy
for what the company considers central to the role. A manual version of this:
read once for the general shape of the role, then a second pass circling every
skill, tool, or domain term that appears more than once.

### Step 3 — Infer the implied, unstated skills

Some requirements imply others without stating them. "Experience with
high-concurrency systems" quietly implies familiarity with things like caching
layers or message queues even if those words never appear. Reading the JD
well means asking, for each stated requirement, *what would someone need to
actually know to do this* — and checking whether the resume's existing
material already covers that implied ground, even if it's currently described
in different words.

### Step 4 — Translate, don't fabricate

Once you know the target vocabulary, go back to the person's real experience
(from `resume-highlight-extraction`) and rephrase genuine accomplishments
using the JD's terms — this is translation of real work into the reader's
vocabulary, not invention of new work. If a JD keyword has no honest match
anywhere in the person's actual experience, it doesn't belong on the resume no
matter how much it would help ATS matching — a keyword with nothing behind it
collapses immediately in an interview and can read as dishonest.

Keywords land best woven into an outcome-oriented bullet (Part 1), not listed
on their own — e.g. not "skills: user segmentation," but "grew private-domain
repeat-purchase rate by 30% through user segmentation and targeted campaigns."
A keyword embedded in a real result carries more signal than the same keyword
sitting in a bare list.

## Part 4 — Select by tag-match to the JD, not generic rank

Highlight selection for a specific application is a matching problem against
*this* JD — not a re-use of a fixed "greatest hits" bullet set, and not a
mechanical application of the general priority ranking from
`resume-highlight-extraction`.

1. **Tag every highlight specifically.** Each highlight should carry tags
   naming the concrete capability/domain it demonstrates (e.g. "concurrency,"
   "security judgment," "system design," "incident response," "independent
   ownership") — not vague catch-alls like "technical skills."
2. **Extract the JD's high-weight keywords** (Part 3): what's flagged
   required, what repeats.
3. **Select the highlights whose tags overlap most with those keywords**,
   for each experience entry — not the highlights that rank highest on the
   generic `resume-highlight-extraction` priority list. A highlight ranked
   #1 on that general list still gets skipped or pushed down the page if it
   doesn't match the current JD; a lower-ranked highlight that does match
   gets promoted instead.
4. **Re-run this matching for every new application.** The same person, the
   same highlight pool, applying to a backend role vs. a security role
   should produce different bullet selections within the same experience
   entry — never carry one fixed bullet set across applications without
   re-matching it against the new JD.

> Don't run one "greatest hits" set for every application — re-match by tag
> against each JD, every time.

## Part 5 — Filling leftover space

The reverse problem: all selected content is placed and the resume still has
room left on the page. Don't fill it by padding — each tier below has a
different lever, tried in this order, and nothing gets added that wouldn't
independently pass the relevance test in Part 1/Part 3.

### Tier 1 — A little leftover space: layout, not content

If the gap is small, close it the same way `resume-one-page-fitting` closes an
overflow, just in reverse: increase body font size (up to the 12pt ceiling)
or loosen line spacing slightly (only enough to look intentional, not so much
that sections start to feel disconnected). Don't reach for new content to
soak up a gap this small.

### Tier 2 — A moderate amount of leftover space: deepen what's already there

Before adding anything new, go back to the candidate pool from
`resume-highlight-extraction` and check whether an existing project/experience
entry already on the resume has another verified, quantified highlight that
didn't make the first cut. Add it as a new bullet to that entry rather than
introducing a new section. Prefer deepening the entries that already rank
highest in relevance/recency (Part 1) — they're the ones that most naturally
absorb extra space and benefit from more evidence. Every added bullet still
has to meet the normal bar: outcome-oriented, quantified, no invented numbers.

### Tier 3 — A lot of leftover space: add a secondarily-relevant entry

Only reach for this once Tiers 1–2 genuinely can't close the gap. Pull a new
project or experience entry from the candidate pool and run it through the
same relevance test as Part 1/Part 3 ("which requirement does this support?")
— it doesn't need to be a top-tier match (a top match would already be on the
resume), but it needs a real, defensible connection to the target role, not
just "impressive in general." Place it after the higher-relevance entries,
consistent with the relevance-drives-ordering principle in Part 1.

## How the three resume skills fit together

1. **`resume-highlight-extraction`** — mine raw experience for the full
   candidate pool of accomplishments, verified and quantified.
2. **`resume-content-and-jd-reading`** (this skill) — read the target JD,
   decide which candidates from the pool are actually relevant to *this* role,
   translate them into the JD's vocabulary, and cut what isn't earning its
   place.
3. **`resume-one-page-fitting`** — take the selected, translated content and
   fit it onto one page through layout adjustments first, then a strict,
   ordered content-trimming algorithm.

`resume-bullet-writing` sits underneath all three steps — it's the reference
for how to actually phrase a bullet (verb choice, the formula, quantification,
length) whenever any of the above requires drafting or rewriting one.
