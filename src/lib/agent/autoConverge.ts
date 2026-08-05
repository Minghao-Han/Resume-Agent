import { continueResumeGeneration } from "./resumeGen";
import { compileToSvg, measureAutoHeight, countBodyChars } from "./typstServerCompile";
import type { AgentTurnUsage } from "./core";

export type RoundResult = {
  sessionId: string | undefined;
  reply: string;
  typstSource: string | null;
  company: string;
  role: string;
  isError: boolean;
  usage: AgentTurnUsage;
};

export type Fit = { pageCount: number; charCount: number | null; fillRatio: number | null };

export type ConvergenceResult = {
  /** Every round in true chronological order — push all of these as chat messages. */
  rounds: RoundResult[];
  /** Index into `rounds` of whichever attempt best fits one page — use THIS one's
   * typstSource/company/role for persisted state, not necessarily the last element
   * (an auto-correction can overshoot and land worse than an earlier attempt). */
  bestIndex: number;
  /** Index-aligned with `rounds` — every round's real (charCount, pageCount,
   * fillRatio) sample, for callers that want to narrow a template's known-good
   * char-count range (see templateCalibration.ts) regardless of whether this
   * particular round needed a correction. */
  fits: Fit[];
};

const MAX_AUTO_ROUNDS = 3;
// The acceptable "converged" band. Anything below this is treated as
// underfull and corrected; the calibration side (templateCalibration.ts)
// uses the same band to decide whether a round's charCount is a genuine
// too-little/too-much sample or just "fine, don't narrow the range".
const MIN_FILL_RATIO = 0.9;
// Aim a bit above the minimum when computing a target to ask for, so a
// correction doesn't land exactly on the boundary.
const TARGET_FILL_RATIO = 0.95;

async function checkFit(typstSource: string | null, realPageHeightPt: number): Promise<Fit> {
  if (!typstSource) return { pageCount: 0, charCount: null, fillRatio: null };
  try {
    const { pageCount } = await compileToSvg(typstSource);
    // Measured regardless of pageCount: insertAutoHeightOverride never forces
    // extra pages for overflow content (a taller single auto page instead —
    // see typstServerCompile.ts), so this also quantifies *how far* over a
    // multi-page doc is, not just that it's over — fillRatio can exceed 1.
    const autoHeightPt = await measureAutoHeight(typstSource);
    const fillRatio = autoHeightPt !== null && realPageHeightPt > 0 ? autoHeightPt / realPageHeightPt : null;
    return { pageCount, charCount: countBodyChars(typstSource), fillRatio };
  } catch {
    return { pageCount: 0, charCount: null, fillRatio: null };
  }
}

function isConverged(fit: Fit): boolean {
  return fit.pageCount === 1 && fit.fillRatio !== null && fit.fillRatio >= MIN_FILL_RATIO;
}

/** Lower is better; 0 means converged. Any overflow is scored much worse than any single-page state, however underfull. */
function distanceToConverged(fit: Fit): number {
  if (fit.pageCount !== 1) return 1000 + fit.pageCount;
  if (fit.fillRatio === null) return 500;
  if (fit.fillRatio >= MIN_FILL_RATIO) return 0;
  return MIN_FILL_RATIO - fit.fillRatio;
}

/**
 * Scales this round's own (charCount, fillRatio) pair to a target char count
 * for the next attempt — self-contained, no stored calibration needed: if
 * charCount characters produced fillRatio fill, charCount/fillRatio is
 * (approximately, assuming body text dominates height) how many characters
 * would fill exactly 100%, so scaling that by TARGET_FILL_RATIO gives a
 * reasonable next target in either direction (fillRatio > 1 for overflow,
 * < 1 for underfill).
 */
function computeTargetCharCount(fit: Fit): number | null {
  if (fit.charCount === null || fit.fillRatio === null || fit.fillRatio <= 0) return null;
  return Math.round((fit.charCount / fit.fillRatio) * TARGET_FILL_RATIO);
}

function buildShortenMessage(fit: Fit): string {
  const target = computeTargetCharCount(fit);
  const hint =
    target !== null && fit.charCount !== null
      ? ` — currently about ${fit.charCount} characters of body content; try trimming to roughly ${target} characters`
      : "";
  return `The compiled resume is currently ${fit.pageCount} pages${hint}. Please shorten it to fit exactly one page${
    hint ? ", cutting roughly that much" : ""
  }.`;
}

function buildFillMessage(fit: Fit): string {
  const usedPct = Math.round((fit.fillRatio ?? 0) * 100);
  const target = computeTargetCharCount(fit);
  const hint =
    target !== null && fit.charCount !== null
      ? ` — currently about ${fit.charCount} characters of body content; try expanding to roughly ${target} characters`
      : " — there's meaningful leftover white space at the bottom";
  return `The compiled resume is only using about ${usedPct}% of the page${hint}. Please fill it${
    target !== null ? ", adding roughly that much" : ""
  }, following the tiered approach in the resume-content-and-jd-reading skill's "Filling leftover space" section (layout adjustments first, then deepen an existing entry with another verified highlight, then add a secondarily-relevant entry only if still needed).`;
}

/**
 * Automatically drives a resume-generation session toward exactly one full
 * page, without any user click: after each round, compiles the real result
 * (server-side, same technique as manual "shorten"/"fill" banners on
 * /generate — see checkFit/typstServerCompile.ts) and, if not converged,
 * sends a corrective message quantified from that round's own observed
 * (charCount, fillRatio) — no separate calibration model needed for this
 * local adjustment — up to MAX_AUTO_ROUNDS additional turns. Tracks every
 * attempt rather than trusting the last one, since a correction can
 * overshoot (e.g. asked to shorten, cuts too much and drops well under the
 * fill threshold).
 */
export async function runConvergenceLoop(
  firstRound: RoundResult,
  realPageHeightPt: number
): Promise<ConvergenceResult> {
  const rounds: RoundResult[] = [firstRound];
  const fits: Fit[] = [await checkFit(firstRound.typstSource, realPageHeightPt)];

  let current = firstRound;
  for (let i = 0; i < MAX_AUTO_ROUNDS; i++) {
    const lastFit = fits[fits.length - 1];
    if (isConverged(lastFit)) break;
    if (!current.sessionId || !current.typstSource || current.isError) break;

    const message = lastFit.pageCount !== 1 ? buildShortenMessage(lastFit) : buildFillMessage(lastFit);
    const next = await continueResumeGeneration({ sessionId: current.sessionId, message });
    rounds.push(next);
    fits.push(await checkFit(next.typstSource, realPageHeightPt));
    current = next;
  }

  let bestIndex = 0;
  let bestScore = Infinity;
  for (let i = 0; i < fits.length; i++) {
    const score = distanceToConverged(fits[i]);
    if (score < bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return { rounds, bestIndex, fits };
}

export { MIN_FILL_RATIO };
