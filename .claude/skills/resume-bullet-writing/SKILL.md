---
name: resume-bullet-writing
description: How to write or rewrite a single resume bullet point — strong verb, achievement-not-duty framing, the verb + what + how + result formula, quantification, length limits, importance ordering, and natural ATS keyword integration. Use this whenever any resume skill needs to phrase, draft, tighten, or shorten a bullet. resume-highlight-extraction, star-q-extraction, resume-generation, and resume-one-page-fitting should all defer to this skill for bullet-writing mechanics rather than restating them.
---

# Resume Bullet Writing

The mechanics of writing one resume bullet point, independent of which skill is calling it (STAR-Q
drafting, highlight extraction, JD-tailored generation, or one-page trimming). Other resume skills
should reference this one instead of re-explaining these rules. This skill doesn't cover *what* to
include or cut (see `resume-content-and-jd-reading`) or *how to fit everything on one page*
(see `resume-one-page-fitting`) — only how to phrase a bullet once you already know what it needs to
say.

## 1. Open with a strong action verb — never passive/duty phrasing

Never start a bullet with "Responsible for...", "Duties included...", or similar passive/duty framing —
these describe a role, not an action, and carry no information about what the person actually did.
Start every bullet with a concrete action verb (led, built, diagnosed, migrated, negotiated, reduced)
and vary the verb across bullets. Repeating the same opening verb across several bullets is usually a
sign they were all written in one pass without each one earning its own claim — see the consistency
check in `resume-content-and-jd-reading`.

## 2. Achievement, not duty — answer "so what"

The single most common failure mode is describing responsibilities instead of results: "Answered
customer calls" tells the reader nothing about impact. For every bullet, ask "so what?" — what changed
because of this — instead of describing the task itself.

## 2a. Front-load the value category — don't make the reader wait for the trailing clause

A subtler version of the same failure: the bullet *does* end on a real result, but the value only
becomes legible in the last few words, after a scanning reader has already moved on. "Migrated 12
secrets to AWS Secrets Manager with least-privilege IAM policies, eliminating plaintext credential
exposure" is technically achievement-framed, but a recruiter skimming the first half sees only
"migrated... to a service" — nothing tells them this is a **security** win until the very end, and the
word "security" never appears at all.

Fix this at the verb and the immediate object, not just the trailing clause: pick an opening that
itself signals the category of value (security, performance, cost, reliability, scale) instead of a
neutral process verb (migrated, built, updated, implemented) that could belong to any kind of change.
Where the underlying JD or role cares about a named category (security, latency, cost), use that
category's own vocabulary near the front of the sentence, not only implied by the result clause.

- Weak (value arrives too late): "Migrated 12 core secrets to AWS Secrets Manager with least-privilege
  IAM policies, eliminating plaintext credential exposure."
- Better (value signaled from word one): "Eliminated plaintext credential exposure by migrating 12 core
  secrets to AWS Secrets Manager with least-privilege IAM policies."
- Weak: "Discovered and fixed an authorization vulnerability across 3 presigned-URL endpoints by
  designing a role-based access control system, preventing unauthorized video access."
- Better: "Closed a security vulnerability letting users access other users' videos: redesigned 3
  presigned-URL endpoints around role-based access control."

Note both fixes did the same thing — they didn't add new content, they reordered the clause that
already existed so the payoff leads instead of trails. If the honest result is a security/performance/
cost win, say so as close to the front of the sentence as the grammar allows.

## 3. Formula: verb + what you did + how + result

A bullet reduces to **action verb + what you did + how you did it + measurable result**. This overlaps
with STAR (Situation, Task, Action, Result), just compressed into one line: the situation/task usually
collapse into a short lead-in clause, and the sentence should end on the result, not trail off after
the action.

## 4. Quantify — a number beats an adjective

Replace vague magnitude words with a number wherever one genuinely exists: not "led a successful
marketing campaign" but "reached 12,000 new customers in 6 weeks." A specific number is more credible
than an impressive-sounding adjective, and it's the first thing a scanning reader's eye catches. Never
invent a number that isn't backed by the underlying source material — see the verification discipline
in `resume-highlight-extraction`; if no number exists, fall back to a precise causal mechanism instead
of a fabricated statistic.

## 5. Keep it tight — one to two lines, one result per bullet

Target one to two lines, ideally under ~20 words. Lead with the verb, state one core result, and stop —
only add a second clause if it's genuinely load-bearing (a constraint, a method) rather than restating
the same point a different way. If a bullet seems to need a second sentence to land, that's usually a
sign it needs tightening, not lengthening. Prefer sentence fragments (no "I," consistent use — or
non-use — of a trailing period) over full grammatical sentences; fragments fit more signal into the
same space.

**Hard limit: a bullet must never exceed 190 characters** (including spaces/punctuation). This is a
non-negotiable cap, not a target — if a draft comes in over 190 characters, cut words until it's under,
don't just aim to shorten it. Count before finalizing any bullet.

## 6. Order by importance, not chronology

Put the strongest, most relevant bullet first within each entry, ranked by relevance to the target
role and size of impact. A reader who only skims for a few seconds should hit the best material
immediately, without reading the whole entry.

## 7. Weave in JD keywords naturally — don't bolt them on

If the person genuinely has the experience a JD keyword names, use the JD's exact term rather than a
synonym. But the keyword has to land inside a real, quantified achievement, not sit alone as a
skill-list entry tacked onto a bullet. "Grew repeat-purchase rate 30% through user segmentation"
carries the keyword "user segmentation" with far more credibility than appending "(user segmentation)"
to an unrelated sentence. Never insert a keyword the person's actual experience doesn't support — see
`resume-content-and-jd-reading` Part 3, Step 4.

## 8. Deciding whether to keep a technical detail

Whether a technical detail earns its place in a bullet isn't just a question of "would a non-technical
recruiter recognize this word" or "is it in the JD" — also ask what the detail is actually proving:
a **decision/trade-off** the person made, or just **how** they implemented something.

- **Decision/trade-off (keep it, jargon and all):** comparing options, choosing between approaches,
  owning the scope of a call. E.g. "chose Redis over a DB-backed cache to cut p99 latency under load."
  Even a reader with zero context immediately understands "this person weighed alternatives and made a
  call" — that's judgment, and it reads regardless of whether the specific term is understood. The
  technical term itself is a bonus: it doubles as an ATS keyword.
- **Pure implementation mechanism (usually cut):** internal algorithm details, library-specific
  plumbing, how something works under the hood with no decision attached. This proves only that the
  person knows the term, not that they exercised judgment or created value — cut it unless this exact
  mechanism *is* the highlight of the experience (e.g. the experience is specifically "I designed this
  algorithm"), in which case keep it and make sure the bullet frames it as a choice/result, not trivia.
  - **Exception — the JD names this exact technology as a keyword:** if a bullet was generalized away
    from a specific tool/technology (e.g. "built an event-driven pipeline" instead of naming Kafka,
    which the highlight's own Skills/Action data confirms was actually used) and the target JD
    explicitly lists that specific term as a requirement, reinstate the specific name even though it
    reads as "just implementation" by the rule above — see `resume-generation`'s keyword-restoration
    rule. At that point ATS/recruiter keyword matching outweighs the general preference for
    decision-framing. Never reinstate a term the highlight's data doesn't actually support.

## 9. Format consistently across the resume

Same bullet symbol, same tense (past tense for past roles; present tense only for a current role's
ongoing responsibilities), same punctuation convention (all periods or none) throughout the document —
pick one and never mix it within a single resume. Inconsistent formatting is a small thing that reads
as carelessness at a glance.

## Quick self-check before finalizing a bullet

- Does it start with an action verb, not "Responsible for" / "Duties included"?
- Does it say what changed, not just what task was performed?
- Would a reader who only reads the first half of the sentence already know what *kind* of win this is
  (security, performance, cost, reliability), or does the value only land in the trailing clause?
- Is there a number — or, if none exists, a precise causal mechanism instead of a vague claim?
- Is it one to two lines, one core result, and under 190 characters?
- Would a reader recognize the JD's vocabulary in it without it feeling force-fit?
- For each technical term: does it signal a decision/trade-off, or just an implementation detail with
  no decision attached? Cut the latter unless it's the core highlight.
- Does its formatting (bullet symbol, tense, punctuation) match every other bullet on the page?
