// Pure, dependency-free char-count range math — kept as its own leaf module
// (rather than living in templateCalibration.ts, which imports resumeGen.ts
// for the calibration LLM call) so both templateCalibration.ts and
// resumeGen.ts can import it without a circular module dependency.

export type CharRange = { low: number | null; high: number | null };

type FitLike = { pageCount: number; charCount: number | null; fillRatio: number | null };

/**
 * Narrows a template's known-good char-count range using one real sample.
 * `low` is the largest char count known to underfill (the sweet spot is
 * above it); `high` is the smallest char count known to overflow (the sweet
 * spot is below it) — a sample inside the acceptable fill band narrows
 * neither, since it isn't a boundary observation.
 */
export function narrowRange(range: CharRange, fit: FitLike, minFillRatio: number): CharRange {
  if (fit.charCount === null || fit.pageCount === 0) return range;
  let { low, high } = range;
  if (fit.pageCount !== 1) {
    high = high === null ? fit.charCount : Math.min(high, fit.charCount);
  } else if (fit.fillRatio !== null && fit.fillRatio < minFillRatio) {
    low = low === null ? fit.charCount : Math.max(low, fit.charCount);
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
