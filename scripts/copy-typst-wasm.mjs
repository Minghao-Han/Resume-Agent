// Copies the typst.ts wasm binaries out of node_modules into public/typst/
// so the browser can fetch them as static assets without hitting a CDN.
import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const outDir = path.join(root, "public", "typst");

const files = [
  [
    "node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm",
    "typst_ts_web_compiler_bg.wasm",
  ],
  [
    "node_modules/@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm",
    "typst_ts_renderer_bg.wasm",
  ],
];

await mkdir(outDir, { recursive: true });
for (const [src, destName] of files) {
  await copyFile(path.join(root, src), path.join(outDir, destName));
}
console.log("Copied typst wasm assets into public/typst/");
