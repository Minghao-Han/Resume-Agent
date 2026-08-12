/**
 * Strips characters invalid in Windows filenames (a strict superset of
 * what's invalid on macOS/Linux), collapses whitespace, and trims trailing
 * dots/spaces (Windows disallows those too). Falls back to "resume" if
 * nothing usable is left.
 */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.\s]+$/, "");
  return cleaned || "resume";
}
