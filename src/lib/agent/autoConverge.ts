import { continueResumeGeneration } from "./resumeGen";
import { compileToSvg, measureAutoHeight } from "./typstServerCompile";

export type RoundResult = {
  sessionId: string | undefined;
  reply: string;
  typstSource: string | null;
  company: string;
  role: string;
  isError: boolean;
};

export type ConvergenceResult = {
  /** Every round in true chronological order — push all of these as chat messages. */
  rounds: RoundResult[];
  /** Index into `rounds` of whichever attempt best fits one page — use THIS one's
   * typstSource/company/role for persisted state, not necessarily the last element
   * (an auto-correction can overshoot and land worse than an earlier attempt). */
  bestIndex: number;
};

const MAX_AUTO_ROUNDS = 3;
const MIN_FILL_RATIO = 0.85;

type Fit = { pageCount: number; fillRatio: number | null };

async function checkFit(typstSource: string | null, realPageHeightPt: number): Promise<Fit> {
  if (!typstSource) return { pageCount: 0, fillRatio: null };
  try {
    const { pageCount } = await compileToSvg(typstSource);
    if (pageCount !== 1) return { pageCount, fillRatio: null };
    const autoHeight = await measureAutoHeight(typstSource);
    const fillRatio = autoHeight !== null && realPageHeightPt > 0 ? autoHeight / realPageHeightPt : null;
    return { pageCount, fillRatio };
  } catch {
    return { pageCount: 0, fillRatio: null };
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

function buildShortenMessage(pageCount: number): string {
  return `The compiled resume is currently ${pageCount} pages. Please shorten it to fit exactly one page.`;
}

function buildFillMessage(fillRatio: number): string {
  const usedPct = Math.round(fillRatio * 100);
  return `The compiled resume is only using about ${usedPct}% of the page — there's meaningful leftover white space at the bottom. Please fill it, following the tiered approach in the resume-content-and-jd-reading skill's "Filling leftover space" section (layout adjustments first, then deepen an existing entry with another verified highlight, then add a secondarily-relevant entry only if still needed).`;
}

/**
 * Automatically drives a resume-generation session toward exactly one full
 * page, without any user click: after each round, compiles the real result
 * (server-side, same technique as manual "shorten"/"fill" banners on
 * /generate — see checkFit/typstServerCompile.ts) and, if not converged,
 * sends the same corrective message those banners already send, up to
 * MAX_AUTO_ROUNDS additional turns. Tracks every attempt rather than
 * trusting the last one, since a correction can overshoot (e.g. asked to
 * shorten, cuts too much and drops well under the fill threshold).
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

    const message =
      lastFit.pageCount !== 1 ? buildShortenMessage(lastFit.pageCount) : buildFillMessage(lastFit.fillRatio ?? 0);
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

  return { rounds, bestIndex };
}
