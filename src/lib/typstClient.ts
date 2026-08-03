"use client";

// Imported lazily / configured once per browser session — typst.ts keeps a
// lazily-initialized global compiler+renderer behind $typst, so we only need
// to point it at the locally-hosted wasm assets a single time, and every
// caller must wait on that same configuration before compiling.
type TypstModule = typeof import("@myriaddreamin/typst.ts");
let readyPromise: Promise<TypstModule> | null = null;

function getTypst() {
  if (!readyPromise) {
    readyPromise = import("@myriaddreamin/typst.ts").then((mod) => {
      mod.$typst.setCompilerInitOptions({ getModule: () => "/typst/typst_ts_web_compiler_bg.wasm" });
      mod.$typst.setRendererInitOptions({ getModule: () => "/typst/typst_ts_renderer_bg.wasm" });
      return mod;
    });
  }
  return readyPromise;
}

export type TypstCompileResult = {
  svg: string;
  pageCount: number;
  width: number;
  height: number;
};

const PAGE_GAP = 24;

/**
 * typst.ts renders multi-page docs as one <svg> with each page's <g
 * class="typst-page"> stacked directly on top of the next (zero gap) — see
 * data-page-width/data-page-height/translate(0, y) on each group. This
 * shifts every page after the first down by PAGE_GAP, bakes a white
 * background rect into each page group (so the gap between pages, and any
 * page margin, reads as a distinct "sheet of paper"), and grows the root
 * <svg>'s height/viewBox to match.
 */
function addPageGaps(svg: string): { svg: string; pageCount: number; width: number; height: number } {
  const pageTagRe = /<g class="typst-page"[^>]*>/g;
  const pages: { tag: string; y: number; w: number; h: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = pageTagRe.exec(svg))) {
    const tag = match[0];
    const yMatch = tag.match(/translate\(([\d.]+),\s*([\d.]+)\)/);
    const wMatch = tag.match(/data-page-width="([\d.]+)"/);
    const hMatch = tag.match(/data-page-height="([\d.]+)"/);
    if (!yMatch || !wMatch || !hMatch) continue;
    pages.push({ tag, y: parseFloat(yMatch[2]), w: parseFloat(wMatch[1]), h: parseFloat(hMatch[1]) });
  }

  const rootMatch = svg.match(/<svg[^>]*viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const naturalWidth = rootMatch ? parseFloat(rootMatch[1]) : pages[0]?.w ?? 0;
  const naturalHeight = rootMatch ? parseFloat(rootMatch[2]) : pages[0]?.h ?? 0;

  if (pages.length <= 1) {
    // Still give the single page a white backing rect for a page-on-desk look.
    const withRect = pages[0]
      ? svg.replace(pages[0].tag, `${pages[0].tag}<rect x="0" y="0" width="${pages[0].w}" height="${pages[0].h}" fill="white"/>`)
      : svg;
    return { svg: withRect, pageCount: pages.length || 1, width: naturalWidth, height: naturalHeight };
  }

  let result = svg;
  pages.forEach((page, index) => {
    const newY = page.y + index * PAGE_GAP;
    const newTag = page.tag.replace(/translate\(([\d.]+),\s*([\d.]+)\)/, `translate($1, ${newY})`);
    const rect = `<rect x="0" y="0" width="${page.w}" height="${page.h}" fill="white"/>`;
    result = result.replace(page.tag, newTag + rect);
  });

  const totalGap = (pages.length - 1) * PAGE_GAP;
  const newHeight = naturalHeight + totalGap;
  result = result
    .replace(/viewBox="0 0 ([\d.]+) [\d.]+"/, `viewBox="0 0 $1 ${newHeight}"`)
    .replace(/ height="[\d.]+"/, ` height="${newHeight}"`)
    .replace(/ data-height="[\d.]+"/, ` data-height="${newHeight}"`);

  return { svg: result, pageCount: pages.length, width: naturalWidth, height: newHeight };
}

export async function compileTypstSvg(source: string): Promise<TypstCompileResult> {
  const { $typst } = await getTypst();
  const rawSvg = await $typst.svg({ mainContent: source });
  return addPageGaps(rawSvg);
}

export async function compileTypstPdf(source: string): Promise<Uint8Array> {
  const { $typst } = await getTypst();
  const pdf = await $typst.pdf({ mainContent: source });
  if (!pdf) throw new Error("Typst compiler returned no PDF output.");
  return pdf;
}

export function downloadPdfBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
