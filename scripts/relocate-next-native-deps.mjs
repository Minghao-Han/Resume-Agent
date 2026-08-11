#!/usr/bin/env node
// After `next build`, Turbopack traces and copies certain dependencies that
// can't be bundled (native addons like better-sqlite3, and @prisma/client)
// into `.next/node_modules/<content-hash>/`, and the compiled server chunks
// require() them by that hashed name — relying on Node's normal
// node_modules-resolution walk finding this directory as an ancestor of the
// requiring chunk file.
//
// npm, however, unconditionally strips any directory literally named
// `node_modules` from a published package, no matter what package.json's
// "files" field says. So publishing `.next` as-is silently drops this
// directory, and the app crashes at runtime with:
//   Cannot find module '<hashed-name>'
//
// Fix: rename it to `.next/vendor` here (a name npm won't touch) right after
// the build, before packing/publishing. bin/resume-agent.js recreates
// `.next/node_modules` from `.next/vendor` at first launch on the end user's
// machine, where the real directory name is required again for Node's
// resolution to work.
//
// As of this writing, the build is invoked as `next build --webpack`
// specifically to avoid triggering this Turbopack-only behavior in the
// first place (see docs/technical-doc.md's npm-packaging section) — under
// webpack, serverExternalPackages like better-sqlite3/@prisma/client should
// just be a plain, unhashed require() resolved against the real
// node_modules, so `.next/node_modules` may simply not exist. That's fine:
// this script is a no-op in that case rather than a hard failure, so the
// publish pipeline doesn't break if/when this whole relocation becomes
// unnecessary.
import fs from "node:fs";
import path from "node:path";

const nextDir = path.resolve(process.cwd(), ".next");
const from = path.join(nextDir, "node_modules");
const to = path.join(nextDir, "vendor");

if (!fs.existsSync(from)) {
  console.log(`[relocate-next-native-deps] ${from} not found, skipping (this build may not have externalized any native dependencies).`);
  process.exit(0);
}

fs.rmSync(to, { recursive: true, force: true });
fs.renameSync(from, to);
console.log(`[relocate-next-native-deps] Renamed ${from} to ${to} (so npm won't strip it).`);
