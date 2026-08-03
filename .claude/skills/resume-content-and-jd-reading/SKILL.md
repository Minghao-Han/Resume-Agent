---
name: resume-content-and-jd-reading
description: Use this when deciding what belongs on a resume versus what should be cut, or when the user has a job description (JD) and needs to figure out what it's actually asking for and how to align resume content to it. Covers content-importance judgment (what recruiters actually weigh vs. what's noise) and a repeatable method for reading a JD to extract required vs. nice-to-have signals. Pairs with resume-highlight-extraction (produces the candidate pool) and resume-one-page-fitting (fits the final selection onto one page) — this skill sits in between: it decides which candidates make the cut for a specific job.
---

# Resume Content Judgment & JD Reading

Two jobs: (1) judge what content on a resume is actually pulling weight versus
just taking up space, and (2) read a JD systematically so "relevant to this
role" is a defensible judgment, not a guess.

## Part 1 — What content matters

### The core shift: outcome-oriented, not responsibility-oriented

The single biggest lever separating a strong bullet from a weak one is whether
it describes *what the person was responsible for* or *what changed because of
them*. The often-cited contrast (originally from the Google resume guide,
widely repeated in resume-writing communities):

- **Responsibility-oriented** (weak): "Analyzed new markets and explored
  potential entrance strategies for China division."
- **Accomplishment-oriented** (strong): "Led entrance strategy for a product
  in China, persuading leadership to refocus on the enterprise market —
  resulting in a 7% increase in profits."

Most people default to writing the responsibility-oriented version because
that's how they experienced the work day to day — the fix isn't more detail,
it's translating the same fact into "what changed" using a metric the target
company would actually track (revenue, users, cost, latency, retention,
error rate, etc., depending on the role).

### What else reliably matters

- **Quantified results over described effort.** "Improved user experience" is
  weak; "raised satisfaction score from 7.5 to 9.0 through an interface
  redesign" is strong — the number substitutes evidence for a claim.
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
  independently justified). Repetition is often the easiest way to spot which
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
