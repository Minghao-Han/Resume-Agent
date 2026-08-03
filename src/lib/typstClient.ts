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
};

export async function compileTypstSvg(source: string): Promise<TypstCompileResult> {
  const { $typst } = await getTypst();
  const svg = await $typst.svg({ mainContent: source });
  const pageCount = (svg.match(/class="typst-page"/g) || []).length;
  return { svg, pageCount };
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
