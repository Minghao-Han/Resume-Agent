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
// silently drops this directory, and the app crashes at runtime with:
//   Cannot find module '<hashed-name>'
//
// The first fix for this (copying the symlinks' real content, dereferenced,
// into `.next/vendor`) was WRONG in a more serious way: better-sqlite3 ships
// a compiled native `.node` binary that's specific to one OS/architecture.
// Copying the *maintainer's own machine's* compiled binary into the
// published package bakes in a binary that only runs on the platform it was
// built on — installing on any other OS fails with an OS-loader error (e.g.
// on Windows: "... is not a valid Win32 application"). better-sqlite3 and
// @prisma/client are already real dependencies of this package, so a normal
// `npm install` already fetches the CORRECT platform-specific binary for
// whoever is installing it, into their own node_modules/ — the only actual
// problem was ever that the compiled output looks for it under a hashed
// name Node can't resolve on its own.
//
// So: don't copy any file content at all. Just record, for each hashed
// entry, which real package (relative to the real node_modules/) its
// symlink pointed at, and ship that tiny mapping as `.next/vendor-map.json`.
// bin/resume-agent.js recreates `.next/node_modules/<hash>` as a fresh
// symlink into the end user's own already-correctly-installed dependency at
// first launch — never touching the binary itself.
import fs from "node:fs";
import path from "node:path";

const nextDir = path.resolve(process.cwd(), ".next");
const nodeModulesDir = path.join(nextDir, "node_modules");
const realNodeModulesDir = path.resolve(process.cwd(), "node_modules");
const manifestPath = path.join(nextDir, "vendor-map.json");

if (!fs.existsSync(nodeModulesDir)) {
  console.log(`[relocate-next-native-deps] ${nodeModulesDir} not found, skipping (this build may not have externalized any native dependencies).`);
  process.exit(0);
}

const manifest = {};

function recordIfSymlink(entryPath, key) {
  if (!fs.lstatSync(entryPath).isSymbolicLink()) return;
  const real = fs.realpathSync(entryPath);
  const rel = path.relative(realNodeModulesDir, real);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    console.warn(`[relocate-next-native-deps] ${key} doesn't resolve inside node_modules/ (-> ${real}), skipping.`);
    return;
  }
  manifest[key] = rel.split(path.sep).join("/");
}

for (const name of fs.readdirSync(nodeModulesDir)) {
  const entryPath = path.join(nodeModulesDir, name);
  if (name.startsWith("@")) {
    // Scoped packages are one directory deeper: @scope/name-<hash>/
    for (const sub of fs.readdirSync(entryPath)) {
      recordIfSymlink(path.join(entryPath, sub), `${name}/${sub}`);
    }
  } else {
    recordIfSymlink(entryPath, name);
  }
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
fs.rmSync(nodeModulesDir, { recursive: true, force: true });
console.log(
  `[relocate-next-native-deps] Recorded ${Object.keys(manifest).length} vendored dependency link(s) to ${manifestPath} and removed ${nodeModulesDir} (npm would have stripped it anyway).`
);
