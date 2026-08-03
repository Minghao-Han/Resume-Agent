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
export function sanitizeGeneratedTypst(source: string): string {
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
