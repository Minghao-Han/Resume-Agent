// Pure, dependency-free char-count range math — kept as its own leaf module
// (rather than living in templateCalibration.ts, which imports resumeGen.ts
// for the calibration LLM call) so both templateCalibration.ts and
// resumeGen.ts can import it without a circular module dependency.

export type CharRange = { low: number | null; high: number | null };

type FitLike = { pageCount: number; charCount: number | null; fillRatio: number | null };

// How far apart to force low/high back apart when a new sample contradicts
// the existing opposite bound (see narrowRange) — char count isn't a
// perfectly deterministic proxy for height (real content vs. calibration
// filler can disagree at the same char count), so this can genuinely happen.
const RESET_WINDOW = 100;

/**
 * Narrows a template's known-good char-count range using one real sample.
 * `low` is the largest char count known to underfill (the sweet spot is
 * above it); `high` is the smallest char count known to overflow (the sweet
 * spot is below it) — a sample inside the acceptable fill band narrows
 * neither, since it isn't a boundary observation.
 *
 * If the new sample would invert the range (the fresher bound crosses past
 * the stale opposite one), trust the fresher sample and collapse to a tight
 * window right at it, discarding the now-contradicted stale bound rather
 * than leaving low > high sitting around.
 */
export function narrowRange(range: CharRange, fit: FitLike, minFillRatio: number): CharRange {
  if (fit.charCount === null || fit.pageCount === 0) return range;
  const { low, high } = range;

  if (fit.pageCount !== 1) {
    const newHigh = high === null ? fit.charCount : Math.min(high, fit.charCount);
    if (low !== null && newHigh < low) {
      return { low: newHigh - RESET_WINDOW, high: newHigh };
    }
    return { low, high: newHigh };
  }

  if (fit.fillRatio !== null && fit.fillRatio < minFillRatio) {
    const newLow = low === null ? fit.charCount : Math.max(low, fit.charCount);
    if (high !== null && newLow > high) {
      return { low: newLow, high: newLow + RESET_WINDOW };
    }
    return { low: newLow, high };
  }

  return { low, high };
}

/**
 * Picks a char-count target to hand the generation model before it writes
 * anything. Midpoint when both bounds are known; an empirical margin off
 * whichever single bound is known; null (no hint) when totally uncalibrated.
 */
export function estimateTargetCharCount(range: CharRange): number | null {
  const { low, high } = range;
  if (low !== null && high !== null) return Math.round((low + high) / 2);
  if (low !== null) return Math.round(low * 1.15);
  if (high !== null) return Math.round(high * 0.85);
  return null;
}
