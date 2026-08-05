import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { PROJECT_ROOT } from "./core";
import { computeCodeMask } from "./typstOutput";

// Server-side (Node) counterpart to src/lib/typstClient.ts — that module is
// browser-only ("use client") and fetches its wasm over HTTP from public/typst/.
// Here we read the same wasm binaries straight off disk, and resolve
// `@preview/...` package imports via a synchronous fetch (the compiler's
// PackageRegistry.resolve callback is called synchronously from inside the
// WASM module, so native fetch — which is always async — can't be used
// directly; shelling out to curl is the pragmatic way to get a blocking HTTP
// GET without a new dependency, and was already validated working earlier in
// this project's development for the same @preview resolution need).
type TypstSnippetModule = typeof import("@myriaddreamin/typst.ts/contrib/snippet");
type TypstMainModule = typeof import("@myriaddreamin/typst.ts");

let readyPromise: Promise<TypstSnippetModule> | null = null;

function fetchPackageSync(url: string): Uint8Array | undefined {
  try {
    const out = execFileSync("curl", ["-sL", url], { maxBuffer: 1024 * 1024 * 50 });
    return new Uint8Array(out);
  } catch {
    return undefined;
  }
}

function getTypst() {
  if (!readyPromise) {
    readyPromise = (async () => {
      const [snippetMod, mainMod]: [TypstSnippetModule, TypstMainModule] = await Promise.all([
        import("@myriaddreamin/typst.ts/contrib/snippet"),
        import("@myriaddreamin/typst.ts"),
      ]);
      const { $typst, TypstSnippet } = snippetMod;
      const { MemoryAccessModel } = mainMod;

      const wasmDir = path.resolve(
        PROJECT_ROOT,
        "node_modules/@myriaddreamin"
      );
      const [compilerWasm, rendererWasm] = await Promise.all([
        readFile(path.join(wasmDir, "typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm")),
        readFile(path.join(wasmDir, "typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm")),
      ]);

      $typst.setCompilerInitOptions({ getModule: () => compilerWasm });
      $typst.setRendererInitOptions({ getModule: () => rendererWasm });

      const accessModel = new MemoryAccessModel();
      $typst.use(
        TypstSnippet.withAccessModel(accessModel),
        TypstSnippet.fetchPackageBy(accessModel, (_spec, url) => fetchPackageSync(url))
      );

      return snippetMod;
    })();
  }
  return readyPromise;
}

export type ServerCompileResult = { svg: string; pageCount: number };

export async function compileToSvg(source: string): Promise<ServerCompileResult> {
  const { $typst } = await getTypst();
  const svg = await $typst.svg({ mainContent: source });
  const pageCount = (svg.match(/class="typst-page"/g) || []).length || 1;
  return { svg, pageCount };
}

const DECLARATION_KEYWORDS = ["#import", "#let", "#set", "#show"];

/**
 * Finds the boundary between a template's declarations (imports, `#let`
 * bindings, `#set`/`#show` rules — including multi-line ones like
 * `#show: resume.with(...)`) and its real body content, and splices in
 * `#set page(height: auto)` right after that boundary.
 *
 * Deliberately not tied to any specific heading convention (e.g. `==`) —
 * it only recognizes declaration keywords, so it works both on templates
 * built around a `@preview` package (whose own internal page setup this
 * later override then takes precedence over, since Typst `set` rules merge
 * per-field and a later one for the same field wins) and on plain
 * hand-written templates with no package import at all.
 *
 * Note: because Typst applies a page-property change starting from the next
 * page, this override causes an (expected, harmless) page break right at the
 * splice point — see measureAutoHeight, which reads the LAST page's height,
 * not the first.
 */
export function insertAutoHeightOverride(source: string): string {
  const mask = computeCodeMask(source);
  const lines = source.split("\n");
  let idx = 0;
  let depth = 0;
  let lastDeclLine = -1;

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const lineStart = idx;
    const lineEnd = idx + line.length;
    const startDepth = depth;

    for (let i = lineStart; i < lineEnd; i++) {
      if (!mask[i]) continue;
      const ch = source[i];
      if (ch === "(" || ch === "[" || ch === "{") depth++;
      else if (ch === ")" || ch === "]" || ch === "}") depth--;
    }

    const trimmed = line.trim();
    const isBlankOrComment = trimmed === "" || trimmed.startsWith("//");
    let startsWithDecl = false;
    if (startDepth === 0 && !isBlankOrComment) {
      for (let i = lineStart; i < lineEnd; i++) {
        if (!mask[i]) continue;
        const rest = source.slice(i, lineEnd);
        startsWithDecl = DECLARATION_KEYWORDS.some((kw) => rest.startsWith(kw));
        break;
      }
    }

    const stillDeclaration = startDepth > 0 || isBlankOrComment || startsWithDecl;
    if (stillDeclaration) {
      lastDeclLine = li;
    } else if (startDepth === 0) {
      break;
    }

    idx = lineEnd + 1;
  }

  if (lastDeclLine === -1) {
    return "#set page(height: auto)\n" + source;
  }
  const withOverride = lines.slice();
  withOverride.splice(lastDeclLine + 1, 0, "#set page(height: auto)");
  return withOverride.join("\n");
}

/**
 * Compiles `source` with the page height forced to auto-fit its content, and
 * returns the resulting content height in pt (the LAST page's height — see
 * insertAutoHeightOverride's note on the page break this causes). Returns
 * null if compilation fails (e.g. malformed synthetic calibration content).
 */
export async function measureAutoHeight(source: string): Promise<number | null> {
  try {
    const { svg } = await compileToSvg(insertAutoHeightOverride(source));
    const heights = [...svg.matchAll(/data-page-height="([\d.]+)"/g)].map((m) => parseFloat(m[1]));
    if (heights.length === 0) return null;
    return heights[heights.length - 1];
  } catch {
    return null;
  }
}

/**
 * Compiles the template as-is (real, fixed page settings — no override) with
 * a trivial placeholder body appended, and returns its real page height in
 * pt. This is the only reliable way to learn a template's actual page
 * dimensions, since e.g. `paper: "us-letter"` handed to an imported
 * package's function is opaque to us at the source-text level.
 */
export async function measureRealPageHeight(templateSource: string): Promise<number | null> {
  // Plain paragraph text only — deliberately avoids any heading syntax or
  // template-specific helper functions (e.g. `==`, `#work(...)`), since this
  // only needs to compile without error, not resemble real resume content.
  const trivialBody = `${templateSource}\n\nPlaceholder content.\n`;
  try {
    const { svg } = await compileToSvg(trivialBody);
    const match = svg.match(/data-page-height="([\d.]+)"/);
    return match ? parseFloat(match[1]) : null;
  } catch {
    return null;
  }
}
