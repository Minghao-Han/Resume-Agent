#!/usr/bin/env node
// After `next build`, Turbopack traces certain dependencies that can't be
// bundled into a JS chunk (native addons like better-sqlite3, and
// @prisma/client) and vendors them under `.next/node_modules/<content-hash>/`
// — but as *symlinks* into the real top-level `node_modules/` (to avoid
// duplicating large native binaries on disk), not real copies. The compiled
// server chunks require() them by that hashed name, relying on Node's normal
// node_modules-resolution walk finding this directory as an ancestor of the
// requiring chunk file.
//
// npm, however, unconditionally strips anything whose path — including a
// *resolved* symlink target — contains a `node_modules` segment, no matter
// what package.json's "files" field says. So publishing `.next` as-is
// silently drops this directory (a plain rename doesn't help either: the
// symlinks inside it still resolve into node_modules/, so npm still strips
// them even under a different container directory name), and the app
// crashes at runtime with:
//   Cannot find module '<hashed-name>'
//
// Fix: copy this directory to `.next/vendor` (a name npm won't touch)
// *dereferencing* symlinks, so what actually gets published is real file
// content, not symlinks pointing back into node_modules/. This runs right
// after the build, before packing/publishing. bin/resume-agent.js recreates
// `.next/node_modules` from `.next/vendor` at first launch on the end user's
// machine, where the real directory name is required again for Node's
// resolution to work.
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
fs.cpSync(from, to, { recursive: true, dereference: true });
fs.rmSync(from, { recursive: true, force: true });
console.log(`[relocate-next-native-deps] Copied (dereferencing symlinks) ${from} to ${to} and removed the original, so npm won't strip it.`);
