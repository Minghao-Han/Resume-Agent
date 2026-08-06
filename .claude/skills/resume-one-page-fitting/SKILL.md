---
name: resume-one-page-fitting
description: Apply this whenever generating or formatting a resume that must fit on exactly one page, or when tailoring resume content to a specific job/company. Covers two things — (1) how to choose which content to include so it demonstrably maps to the target role/company's needs, and (2) a strict, ordered algorithm for shrinking an over-length resume (layout adjustments before content cuts, with a defined priority order for both) rather than cutting arbitrarily. Use this together with resume-highlight-extraction: that skill produces the pool of candidate bullets, this skill selects and fits them onto one page for a specific application.
---

# Resume One-Page Fitting

Two responsibilities: (1) selecting content that's provably relevant to the
target role/company, and (2) fitting the result onto exactly one page through a
strict, ordered adjustment algorithm — never arbitrary trimming.

## 1. Selection principle

Every bullet, skill, course, or project kept on the resume must be there because
it demonstrates value to **this specific job/company** — not "impressive in
general." Before including anything, be able to answer: *which requirement in
the job description (or which known priority of this company) does this item
support?* If the answer is vague, that item is a cut candidate even before the
page-length check kicks in.

This means the same underlying experience can be summarized differently, or
excluded entirely, depending on the target role — don't reuse one fixed bullet
set across applications without re-checking relevance.

## 2. One-page constraint: the adjustment algorithm

**Top-level rule: fix length via LAYOUT first, and only touch CONTENT if layout
adjustments alone can't bring it to one page.** Content is the harder-to-reverse,
higher-cost lever — exhaust layout options first.

### Step A — Layout adjustments (try first, in this order)

1. **Font size**: adjust body text within the **10–12pt** range. Do not go below
   10pt for body text regardless of how much space is needed — readability is a
   hard floor, not a soft preference.
2. **Line spacing**: reduce line spacing next, but only down to the point where
   lines remain clearly separated. Two hard constraints:
   - No visual overlap between lines.
   - No lines touching/crowding each other (there must be visible whitespace
     between lines, even if tight).
   If tightening line spacing further would violate either constraint, stop —
   move to content adjustments instead of pushing spacing past readability.

Only proceed to Step B if Step A's full range has been used and the resume still
exceeds one page.

### Step B — Content adjustments (only after Step A is exhausted)

**Section priority — cut from these in this exact order** (least expendable
last, i.e. protect Experience the longest):

1. Relevant Courses *(cut/shrink first)*
2. Skills
3. Projects
4. Experience *(cut last — most valuable section, touch only if the other three
   are already fully exhausted)*

**Experience > Project by default.** Experience is inherently weighted higher
than Projects — when both need trimming, exhaust Project cuts first. This holds
*unless a specific project is highly relevant to the target job/company*, in
which case that project should be treated as on par with (or above) a
less-relevant Experience entry:

- Apply the Section 1 relevance test per-item, not just per-section. A highly
  job-relevant Project can outrank a weakly-relevant Experience entry — don't
  mechanically protect all Experience over all Projects regardless of fit.
- When in doubt (relevance is ambiguous, not clearly "highly relevant"), default
  back to the standard rule: Experience is protected over Projects.
- This exception only reorders *which specific item* gets cut first — it doesn't
  change the overall Courses → Skills → Projects → Experience section pass
  order; it just means a stray highly-relevant Project shouldn't be gutted
  before a barely-relevant Experience bullet purely because "Projects" comes
  before "Experience" in the pass order.

For each section, before applying the general trimming method below, apply this
section-specific pre-filter:

> **Skills / Relevant Courses only**: before deleting anything else, first
> remove any item whose competency is *already demonstrated elsewhere* on the
> resume (e.g., a skill visibly used in a Project or Experience bullet doesn't
> also need its own line in the Skills list). This is a redundancy cut, not a
> value cut — it should always be applied before cutting anything that adds new
> signal.

**Within a given section, the trimming method priority is:**

1. **If the item is a bullet point → shorten the sentence first** (tighten
   wording, cut filler, combine clauses) rather than deleting it outright. Cut
   words, don't rewrite from scratch — keep the verb, the result, and the
   number from `resume-bullet-writing`'s formula intact; if a cut would remove
   the quantified result rather than a filler word, that bullet is a deletion
   candidate (step 2 below), not a shortening candidate.
2. **If shortening isn't enough and the section is Experience specifically**:
   check how many bullets that experience entry currently has.
   - If it has **more than 2 bullets**, delete one bullet from it (delete the
     weakest/least role-relevant one, not just the last one).
   - If it already has **2 or fewer bullets**, do not delete further from this
     entry — move on to the next content-adjustment target in the section
     priority order instead. (Don't hollow out an experience entry below 2
     bullets just to save space; that damages the resume more than it helps.)

### Full decision flow (pseudocode)

```
while resume.length > 1 page:
    if layout_budget_remaining():
        shrink_font()          # down to 10pt floor
        elif tighten_line_spacing()   # down to no-overlap / no-crowd floor
        continue

    # layout exhausted — move to content, in section order
    for section in [RelevantCourses, Skills, Projects, Experience]:
        if section in (Skills, RelevantCourses):
            remove_items_redundant_with_other_sections(section)
            if resume.length <= 1 page: break

        for item in section.items:
            if item.is_bullet_point:
                shorten_sentence(item)
                if resume.length <= 1 page: break
                if section == Experience and item.entry.bullet_count > 2:
                    delete_weakest_bullet(item.entry)
                else:
                    continue  # move to next item/section, don't force-cut
        if resume.length <= 1 page: break
```

## 3. Guardrails

- Never drop body font below 10pt or compress spacing until lines touch —
  readability failures undermine every other optimization.
- Never cut an Experience entry down to 0–1 bullets just to hit one page; if
  content cuts alone can't close the gap without violating this, that's a signal
  the resume needs a genuine content trim from `resume-highlight-extraction`
  (i.e., drop a whole weaker highlight), not more aggressive shrinking of a
  strong one.
- Always re-check the Section 1 relevance test after every cut — if you're
  forced to a hard choice between two items, keep the one more clearly tied to
  the target job/company, regardless of which section priority order says to
  touch first. (This is the same principle behind the Experience-vs-Project
  exception above — relevance can override default section ordering, but only
  when relevance is clearly, not marginally, higher.)
