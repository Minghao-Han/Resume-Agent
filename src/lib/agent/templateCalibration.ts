import { prisma } from "@/lib/db";
import { runAgentTurn, extractAllFencedBlocks } from "./core";
import { sanitizeTemplateSource } from "./templateSanitize";
import { sanitizeGeneratedTypst } from "./typstOutput";
import { measureAutoHeight, measureRealPageHeight } from "./typstServerCompile";

export type TemplateCalibration = {
  intercept: number;
  perEntry: number;
  perBullet: number;
  perChar: number;
  realPageHeightPt: number;
  calibratedAt: string;
};

// A deliberately non-collinear set of (entries, bulletsPerEntry, charsPerBullet)
// combinations — varying entries and bullets-per-entry independently, and
// spreading totalBullets/totalChars unevenly across them, so the 4-unknown
// OLS fit below isn't solving a near-singular system.
// charsPerBullet deliberately spans a wide range (40-220) so bullets clearly
// cross multiple line-wrap thresholds (a narrower band risks most variants
// landing on the same wrapped-line-count, starving the per-char term of
// real signal and letting OLS noise assign it an implausible sign).
const VARIANT_SPECS = [
  { entries: 1, bulletsPerEntry: 2, charsPerBullet: 40 },
  { entries: 2, bulletsPerEntry: 2, charsPerBullet: 100 },
  { entries: 2, bulletsPerEntry: 4, charsPerBullet: 70 },
  { entries: 3, bulletsPerEntry: 2, charsPerBullet: 180 },
  { entries: 3, bulletsPerEntry: 4, charsPerBullet: 130 },
  { entries: 4, bulletsPerEntry: 3, charsPerBullet: 220 },
  { entries: 4, bulletsPerEntry: 5, charsPerBullet: 60 },
  { entries: 5, bulletsPerEntry: 3, charsPerBullet: 150 },
];

const FILLER_TEXT =
  "Independently designed and implemented a scalable backend service integrating multiple " +
  "third party systems while maintaining strict data consistency and comprehensive automated " +
  "test coverage across the entire distributed architecture and deployment pipeline";

const SYSTEM_PROMPT = `You produce synthetic calibration variants of a resume Typst template for a resume-building tool — NOT a real resume, just structurally-correct filler used to measure how much vertical space this template's own entry/bullet formatting takes up.

You will be given a Typst template (style/layout reference, same rules as normal resume generation: keep any \`#import "@preview/...": *\` line unchanged, call the template's own functions like \`resume.with(...)\`/\`edu(...)\`/\`work(...)\`/\`project(...)\` exactly as it does, never redefine them or invent your own styling) and a numbered list of variants to produce.

For EACH variant, in order, output ONE complete, compilable Typst document as its own fenced code block tagged \`\`\`typst — nothing else between blocks, no explanations, no numbering text outside the code blocks. Each document must:
- Use plausible fake placeholder personal info (any name/email, doesn't need to be realistic) so the header renders normally — accuracy doesn't matter here.
- Include a short Education section (one entry) and a Skills section (one line) exactly like a normal resume, unchanged across all variants — only the Experience section should vary per variant.
- In the Experience section, create exactly the given number of entries, each with exactly the given number of bullets, and for EVERY bullet use EXACTLY this filler text truncated to the given character count (do not paraphrase, do not write real content, use it verbatim character-for-character up to the length given): "${FILLER_TEXT}"

Output exactly ${VARIANT_SPECS.length} fenced \`\`\`typst blocks, one per variant, in the given order. Nothing else.`;

function buildCalibrationPrompt(templateSource: string): string {
  const cleanedTemplate = sanitizeTemplateSource(templateSource, {
    name: "",
    phone: "",
    email: "",
    location: "",
    github: "",
    linkedin: "",
    educations: [],
  });

  const variantLines = VARIANT_SPECS.map((v, i) => {
    const totalBullets = v.entries * v.bulletsPerEntry;
    return `Variant ${i + 1}: ${v.entries} experience entries, ${v.bulletsPerEntry} bullets per entry (${totalBullets} bullets total), each bullet's filler text truncated to exactly ${v.charsPerBullet} characters.`;
  });

  return [
    `Typst template:\n\`\`\`typst\n${cleanedTemplate}\n\`\`\``,
    `\nVariants to produce, in order:`,
    ...variantLines,
    `\nProduce all ${VARIANT_SPECS.length} variants now.`,
  ].join("\n");
}

function countChars(bulletText: string): number {
  return bulletText.length;
}

/**
 * Runs one LLM turn to get structurally-valid calibration variants for a
 * template, compiles each with a height:auto override to measure real
 * content height, and fits a linear model `height ~ entries + bullets +
 * chars` via ordinary least squares (closed-form, no ML dependency).
 * Returns null if too few variants compiled successfully to fit (need at
 * least 4 for the 4-unknown system) or the fit is degenerate.
 */
export async function calibrateTemplate(templateSource: string): Promise<TemplateCalibration | null> {
  const prompt = buildCalibrationPrompt(templateSource);

  const { replyText, isError } = await runAgentTurn(prompt, {
    systemPrompt: SYSTEM_PROMPT,
    tools: [],
    allowedTools: [],
    settingSources: [],
    settings: { autoMemoryEnabled: false },
    permissionMode: "default",
  });

  if (isError) return null;

  const blocks = extractAllFencedBlocks(replyText, "typst").map(sanitizeGeneratedTypst);
  if (blocks.length === 0) return null;

  const points: { entries: number; bullets: number; chars: number; height: number }[] = [];
  for (let i = 0; i < Math.min(blocks.length, VARIANT_SPECS.length); i++) {
    const spec = VARIANT_SPECS[i];
    const height = await measureAutoHeight(blocks[i]);
    if (height === null) continue;
    points.push({
      entries: spec.entries,
      bullets: spec.entries * spec.bulletsPerEntry,
      chars: spec.entries * spec.bulletsPerEntry * countChars(FILLER_TEXT.slice(0, spec.charsPerBullet)),
      height,
    });
  }

  if (points.length < 4) return null;

  const realPageHeightPt = await measureRealPageHeight(templateSource);
  if (realPageHeightPt === null) return null;

  const fit = fitLinearModel(points);
  if (!fit || !isPlausibleFit(fit, realPageHeightPt)) return null;

  return {
    ...fit,
    realPageHeightPt,
    calibratedAt: new Date().toISOString(),
  };
}

/**
 * Runs calibration and persists the result — meant to run inside `after()`
 * so the template-save request doesn't wait on it. Best-effort: any failure
 * (LLM error, singular fit, compile failure) just leaves `calibration` at
 * its previous value (null on first save), which generation already treats
 * as "no budget hint available" rather than an error.
 */
export async function runAndStoreCalibration(templateId: string, typstSource: string): Promise<void> {
  try {
    const calibration = await calibrateTemplate(typstSource);
    if (!calibration) return;
    await prisma.resumeTemplate.update({
      where: { id: templateId },
      data: { calibration: JSON.stringify(calibration) },
    });
  } catch (err) {
    console.error(`[templateCalibration] failed for template ${templateId}:`, err);
  }
}

/**
 * OLS has no notion of physical plausibility — more entries/bullets/chars
 * can never make a document shorter, and the base (zero-content) height
 * can't be negative or exceed a full page. Reject fits that violate these
 * even though the regression "succeeded" numerically; downstream treats a
 * null calibration as a safe no-op rather than acting on a nonsensical one.
 */
function isPlausibleFit(
  fit: { intercept: number; perEntry: number; perBullet: number; perChar: number },
  realPageHeightPt: number
): boolean {
  return (
    fit.intercept >= 0 &&
    fit.intercept < realPageHeightPt &&
    fit.perEntry >= 0 &&
    fit.perBullet >= 0 &&
    fit.perChar >= 0
  );
}

function fitLinearModel(
  points: { entries: number; bullets: number; chars: number; height: number }[]
): { intercept: number; perEntry: number; perBullet: number; perChar: number } | null {
  const n = 4;
  const XtX: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const Xty: number[] = new Array(n).fill(0);

  for (const p of points) {
    const row = [1, p.entries, p.bullets, p.chars];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) XtX[i][j] += row[i] * row[j];
      Xty[i] += row[i] * p.height;
    }
  }

  const solved = solveLinearSystem(XtX, Xty);
  if (!solved) return null;
  return { intercept: solved[0], perEntry: solved[1], perBullet: solved[2], perChar: solved[3] };
}

/** Gauss-Jordan elimination with partial pivoting. Returns null if the system is singular (calibration points too collinear). */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivotRow][col])) pivotRow = r;
    }
    [M[col], M[pivotRow]] = [M[pivotRow], M[col]];
    const pivotVal = M[col][col];
    if (Math.abs(pivotVal) < 1e-9) return null;
    for (let j = col; j <= n; j++) M[col][j] /= pivotVal;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      for (let j = col; j <= n; j++) M[r][j] -= factor * M[col][j];
    }
  }

  return M.map((row) => row[n]);
}
