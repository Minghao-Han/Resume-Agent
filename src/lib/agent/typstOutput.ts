/** Marks, for each index in `source`, whether that character sits inside a
 * Typst string literal or comment (as opposed to real markup/code) — used
 * by every fix below to avoid touching string/comment content. Also reused
 * by typstServerCompile.ts to find the boundary between a template's
 * declarations and its real body content. */
export function computeCodeMask(source: string): boolean[] {
  const mask = new Array<boolean>(source.length).fill(true);
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    const prev = i > 0 ? source[i - 1] : "";

    if (inLineComment) {
      mask[i] = false;
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      mask[i] = false;
      if (prev === "*" && ch === "/") inBlockComment = false;
      continue;
    }
    if (!inString && ch === "/" && next === "/") {
      inLineComment = true;
      mask[i] = false;
      continue;
    }
    if (!inString && ch === "/" && next === "*") {
      inBlockComment = true;
      mask[i] = false;
      continue;
    }
    if (ch === '"' && prev !== "\\") {
      inString = !inString;
      mask[i] = false;
      continue;
    }
    if (inString) mask[i] = false;
  }

  return mask;
}

/**
 * Escapes two categories of stray special characters that keep showing up
 * unescaped in model-generated resume prose and breaking compilation:
 *
 * - "@word" (e.g. `@Version`, `@Override`, an unescaped email/handle) is
 *   parsed by Typst as a citation/label reference -> "label <...> does not
 *   exist". Relying on the model to remember to escape every "@" proved
 *   unreliable in testing (same failure mode as the `@preview` import
 *   issue), so any bare "@" immediately followed by a letter/digit gets
 *   escaped to "\@".
 * - "$digit" (e.g. a dollar amount like "$800") starts Typst math mode,
 *   which — lacking a real closing "$" — either swallows the rest of the
 *   document or throws its own parse error. Any bare "$" immediately
 *   followed by a digit gets escaped to "\$"; genuine math mode in resume
 *   prose is essentially never intended.
 *
 * Both skip characters already escaped, ones inside string literals (e.g.
 * `#let email = "a@b.com"`, where the char is just string content, not
 * markup), and ones inside comments (Typst never parses either there).
 */
function escapeStraySpecialChars(source: string): string {
  let result = "";
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    const prev = i > 0 ? source[i - 1] : "";

    if (inLineComment) {
      result += ch;
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      result += ch;
      if (prev === "*" && ch === "/") inBlockComment = false;
      continue;
    }
    if (!inString && ch === "/" && next === "/") {
      inLineComment = true;
      result += ch;
      continue;
    }
    if (!inString && ch === "/" && next === "*") {
      inBlockComment = true;
      result += ch;
      continue;
    }
    if (ch === '"' && prev !== "\\") {
      inString = !inString;
      result += ch;
      continue;
    }
    if (!inString && ch === "@" && prev !== "\\" && next && /[A-Za-z0-9_]/.test(next)) {
      result += "\\@";
      continue;
    }
    if (!inString && ch === "$" && prev !== "\\" && next && /[0-9]/.test(next)) {
      result += "\\$";
      continue;
    }
    result += ch;
  }

  return result;
}

/**
 * Fixes a subtle Typst parsing ambiguity that produced a real "unclosed
 * delimiter" error: `_#identifier_` (interpolating a bare variable inside
 * emphasis markup, e.g. `_#degree_` to italicize a value) gets misparsed
 * because "_" is a valid identifier-continuation character in Typst — the
 * trailing "_" is swallowed into the variable's name (parsed as a reference
 * to a variable literally called `degree_`) instead of closing the
 * emphasis, leaving the opening "_" with no matching close. Verified
 * directly: `_#degree_` fails to compile, `_#(degree)_` compiles fine.
 * Wrapping the interpolation in parens is always semantically equivalent
 * for a bare identifier, so this rewrite is safe even in the (very
 * unlikely) case a variable is genuinely named with a trailing underscore.
 */
function wrapAmbiguousUnderscoreInterpolation(source: string): string {
  const mask = computeCodeMask(source);
  const pattern = /_#([A-Za-z_][\w-]*)_/g;
  let result = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source))) {
    const start = match.index;
    const end = start + match[0].length;
    const isRealCode = mask.slice(start, end).every(Boolean);
    result += source.slice(lastIndex, start);
    result += isRealCode ? `_#(${match[1]})_` : match[0];
    lastIndex = end;
  }
  result += source.slice(lastIndex);

  return result;
}

/**
 * Rewrites Markdown-style `**bold**` to Typst's actual strong-emphasis
 * syntax, a single asterisk on each side (`*bold*`). Verified directly:
 * Typst parses `**text**` as two back-to-back empty strong spans followed by
 * plain "text" — it silently renders as ordinary, non-bold text with no
 * compile error, so a model reaching for the (far more common, and the one
 * used by this very skill file's own prose) Markdown convention produces a
 * resume with none of its intended bold formatting and no visible signal
 * anything went wrong. Relying on prompt instructions alone proved
 * unreliable in testing (same failure mode as the other fixes in this
 * file), so this is a deterministic safety net.
 */
function convertMarkdownBoldToTypst(source: string): string {
  const mask = computeCodeMask(source);
  const pattern = /\*\*([^*\n]+?)\*\*/g;
  let result = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source))) {
    const start = match.index;
    const end = start + match[0].length;
    const isRealCode = mask.slice(start, end).every(Boolean);
    result += source.slice(lastIndex, start);
    result += isRealCode ? `*${match[1]}*` : match[0];
    lastIndex = end;
  }
  result += source.slice(lastIndex);

  return result;
}

export function sanitizeGeneratedTypst(source: string): string {
  return convertMarkdownBoldToTypst(wrapAmbiguousUnderscoreInterpolation(escapeStraySpecialChars(source)));
}
