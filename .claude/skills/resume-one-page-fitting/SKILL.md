---
name: resume-one-page-fitting
description: Apply this whenever a drafted resume must fit on exactly one page. Covers a strict, ordered algorithm for shrinking an over-length resume — layout adjustments before content cuts, with a defined priority order for both — rather than cutting arbitrarily. Content selection itself (what belongs on the resume for a given JD) is resume-content-and-jd-reading's job; this skill takes already-selected content and fits it onto one page.
---

# Resume One-Page Fitting

Fit already-selected resume content onto exactly one page through a strict,
ordered adjustment algorithm — never arbitrary trimming.

## 1. Selection principle

Content selection itself (what belongs on the resume for this JD, and why) is
`resume-content-and-jd-reading`'s job — see its Parts 1, 3, and 4. This skill
picks up after that: given already-selected content, fit it onto one page. The
one thing carried over here is the relevance ordering that selection produces —
it's also what decides *which* item gets cut first below (Step B, and the
guardrails in Section 3).

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

**Experience > Project by default**, same priority as `resume-generation`'s
Pass 1/Pass 2 selection rule — when both need trimming, exhaust Project cuts
first. Exception: a project highly relevant to the target job/company is on par
with (or above) a less-relevant Experience entry, per the Section 1 relevance
test applied per-item, not per-section. When relevance is ambiguous rather than
clearly high, default back to protecting Experience. This exception only
reorders *which specific item* gets cut first — it doesn't change the overall
Courses → Skills → Projects → Experience section pass order.

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
