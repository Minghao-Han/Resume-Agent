#!/usr/bin/env node

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

// ---------------------------------------------------------------------------
// Package-relative paths (once published, this script lives at
// <package_root>/bin/resume-agent.js)
// ---------------------------------------------------------------------------
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const NEXT_DIR = PACKAGE_ROOT; // `next start` needs to run against the directory containing .next (or pass it explicitly)
const PRISMA_SCHEMA_PATH = path.join(PACKAGE_ROOT, 'prisma', 'schema.prisma');
const MIGRATIONS_DIR = path.join(PACKAGE_ROOT, 'prisma', 'migrations');
// Prisma 7 reads datasource.url exclusively from this config file — the
// schema.prisma datasource block deliberately has no url. Passing --config
// explicitly (rather than relying on cwd-based auto-discovery) avoids any
// ambiguity from how different platforms/package managers lay out a global
// install's working directory.
const PRISMA_CONFIG_PATH = path.join(PACKAGE_ROOT, 'prisma.config.ts');
const PACKAGE_VERSION = require(path.join(PACKAGE_ROOT, 'package.json')).version;
// Records the last migration folder name successfully applied by this CLI —
// lets a normal launch skip spawning the Prisma CLI entirely when nothing
// has changed. See runMigrations() for why this is safe.
const MIGRATION_MARKER_NAME = '.last-migration';

const PORT = process.env.PORT || '3000';
const HOST = process.env.HOST || 'localhost';

function log(msg) {
  console.log(`[resume-agent] ${msg}`);
}

function fail(msg, err) {
  console.error(`[resume-agent] Error: ${msg}`);
  if (err) console.error(err);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Step 1: locate / create ~/.resume-agent on first run
// ---------------------------------------------------------------------------
function ensureDataDir() {
  const dataDir = path.join(os.homedir(), '.resume-agent');
  const storageDir = path.join(dataDir, 'storage', 'resumes');

  for (const dir of [dataDir, storageDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      log(`Created directory: ${dir}`);
    }
  }

  return { dataDir, storageDir, dbPath: path.join(dataDir, 'dev.db') };
}

// ---------------------------------------------------------------------------
// Step 2: set DATABASE_URL — this is what fixes the "relative path" hazard:
// no matter which cwd the user launches from, DATABASE_URL always points at
// the fixed, per-user data directory.
// ---------------------------------------------------------------------------
function setEnv({ dbPath, storageDir }) {
  process.env.DATABASE_URL = 'file:' + dbPath;
  // If app code elsewhere also reads/writes storage/resumes via a relative
  // path, it should read this env var too, instead of joining process.cwd().
  process.env.RESUME_STORAGE_DIR = storageDir;
  log(`DATABASE_URL = ${process.env.DATABASE_URL}`);
  log(`RESUME_STORAGE_DIR = ${process.env.RESUME_STORAGE_DIR}`);
}

// ---------------------------------------------------------------------------
// Step 3: run migrations
//
// `prisma migrate deploy` only ever applies migrations that aren't already
// recorded as applied, in order — it never drops/resets/diffs anything, so
// running it repeatedly is safe by design (this is the same command CI/CD
// pipelines run on every deploy). It cannot cause data loss on its own.
//
// What it *does* cost is time: spawning the Prisma CLI, loading its bundle,
// connecting, and diffing the migrations table happens on every single
// launch, even when there's nothing to do — noticeably slowing down what
// should be an instant local app start.
//
// So: skip spawning it at all when nothing has changed. We key this on the
// actual contents of prisma/migrations/ (the latest migration folder name),
// not just "have we ever migrated" — so a newer resume-agent version that
// ships new migrations is still picked up automatically, and the marker is
// only ever written *after* a successful `migrate deploy`, so a failed or
// interrupted run can never leave the marker out of sync with real DB state.
// ---------------------------------------------------------------------------
function latestMigrationName() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return null;
  const names = fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  return names.length > 0 ? names[names.length - 1] : null;
}

function runMigrations(dataDir) {
  if (!fs.existsSync(PRISMA_SCHEMA_PATH)) {
    fail(`Prisma schema not found: ${PRISMA_SCHEMA_PATH}\nMake sure prisma/schema.prisma is included in the published package.`);
  }
  if (!fs.existsSync(PRISMA_CONFIG_PATH)) {
    fail(
      `Prisma config file not found: ${PRISMA_CONFIG_PATH}\n` +
        "datasource.url is read from this file (schema.prisma has no url) — " +
        'make sure prisma.config.ts is included in the published package (package.json\'s "files" field).'
    );
  }

  const marker = path.join(dataDir, MIGRATION_MARKER_NAME);
  const latest = latestMigrationName();
  const lastApplied = fs.existsSync(marker) ? fs.readFileSync(marker, 'utf8').trim() : null;

  if (latest && latest === lastApplied) {
    return; // already up to date as of the last successful run — nothing to do
  }

  log('Checking and applying database migrations...');

  const result = spawnSync(
    process.execPath,
    [
      require.resolve('prisma/build/index.js', { paths: [PACKAGE_ROOT] }),
      'migrate',
      'deploy',
      '--schema',
      PRISMA_SCHEMA_PATH,
      '--config',
      PRISMA_CONFIG_PATH,
    ],
    {
      stdio: 'inherit',
      env: process.env,
      cwd: PACKAGE_ROOT,
    }
  );

  if (result.error) {
    fail('Failed to run `prisma migrate deploy`', result.error);
  }
  if (result.status !== 0) {
    fail(`\`prisma migrate deploy\` exited with code ${result.status}`);
  }

  if (latest) fs.writeFileSync(marker, latest);
  log('Migrations up to date.');
}

// ---------------------------------------------------------------------------
// Step 5: open the default browser, cross-platform (no extra dependency)
// ---------------------------------------------------------------------------
function openBrowser(url) {
  const platform = process.platform;
  let cmd;
  let args;

  if (platform === 'darwin') {
    cmd = 'open';
    args = [url];
  } else if (platform === 'win32') {
    cmd = 'cmd';
    args = ['/c', 'start', '""', url];
  } else {
    cmd = 'xdg-open';
    args = [url];
  }

  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
  } catch (err) {
    // Failing to open a browser shouldn't block the server from starting —
    // just tell the user to open it themselves.
    log(`Could not open the browser automatically — please visit ${url} manually.`);
  }
}

// ---------------------------------------------------------------------------
// Restore native/special dependencies Turbopack "externalized" at build time
// (better-sqlite3, @prisma/client).
//
// `next build` (Turbopack) copies dependencies that can't be bundled into a
// JS chunk into `.next/node_modules/<content-hash>/`, and the compiled
// output require()s them by that hashed name, relying on Node's normal
// node_modules resolution to find that directory.
//
// But npm unconditionally strips any directory literally named
// node_modules from a published package, no matter what package.json's
// "files" field says — so scripts/relocate-next-native-deps.mjs renames it
// to `.next/vendor` at publish time (a name npm won't touch), and this
// function renames it back to `.next/node_modules` on the end user's
// machine the first time they launch, so those hashed require() calls in
// the compiled output can resolve again.
// ---------------------------------------------------------------------------
function ensureNativeVendorModules() {
  const vendorDir = path.join(NEXT_DIR, '.next', 'vendor');
  const nodeModulesDir = path.join(NEXT_DIR, '.next', 'node_modules');

  if (!fs.existsSync(vendorDir)) return; // normal for a local `next build` during development
  if (fs.existsSync(nodeModulesDir)) return; // already restored on a previous launch

  log('Restoring native dependencies externalized at build time (better-sqlite3, etc.)...');
  try {
    fs.renameSync(vendorDir, nodeModulesDir);
  } catch (err) {
    // Rare cross-device/permission edge case — fall back to copying.
    try {
      fs.cpSync(vendorDir, nodeModulesDir, { recursive: true });
    } catch (copyErr) {
      fail('Failed to restore native dependencies — the app may not be able to connect to the database', copyErr);
    }
  }
}

// ---------------------------------------------------------------------------
// Step 4: start the bundled Next.js server
// ---------------------------------------------------------------------------
function startServer() {
  const nextBin = require.resolve('next/dist/bin/next', { paths: [PACKAGE_ROOT] });

  if (!fs.existsSync(path.join(NEXT_DIR, '.next'))) {
    fail(`Build output not found: ${path.join(NEXT_DIR, '.next')}\nMake sure \`next build\` was run and .next was included in the published package.`);
  }

  log(`Starting server: http://${HOST}:${PORT}`);

  const server = spawn(
    process.execPath,
    [nextBin, 'start', NEXT_DIR, '-p', PORT, '-H', HOST],
    {
      stdio: 'inherit',
      env: process.env,
      // `next start <dir>` does NOT chdir the process — it only resolves
      // build artifacts relative to <dir>. Without this, the server's
      // process.cwd() would stay whatever directory the user happened to
      // invoke `resume-agent` from, and src/lib/agent/core.ts's
      // `PROJECT_ROOT = process.cwd()` would then fail to find
      // .claude/CLAUDE.md and .claude/skills/ (they'd silently not load —
      // no crash, just degraded AI behavior). Pinning cwd here is what
      // actually makes PROJECT_ROOT resolve to the package root.
      cwd: PACKAGE_ROOT,
    }
  );

  server.on('error', (err) => fail('Failed to start the Next.js server', err));

  server.on('exit', (code) => {
    process.exit(code === null ? 1 : code);
  });

  // The server starts up asynchronously — opening the browser before `next
  // start` prints "Ready" is harmless, so just delay slightly to reduce the
  // odds of the user seeing "this site can't be reached" for a moment.
  setTimeout(() => openBrowser(`http://${HOST}:${PORT}`), 1500);

  // Make sure Ctrl+C actually kills the child process too.
  const forwardSignal = (signal) => {
    process.on(signal, () => {
      server.kill(signal);
    });
  };
  forwardSignal('SIGINT');
  forwardSignal('SIGTERM');
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
function main() {
  const args = process.argv.slice(2);
  if (args.includes('--version') || args.includes('-v')) {
    console.log(PACKAGE_VERSION);
    return;
  }
  if (args.includes('--help') || args.includes('-h')) {
    console.log(
      [
        `resume-agent v${PACKAGE_VERSION}`,
        '',
        'Usage: resume-agent [options]',
        '',
        'Options:',
        '  --version, -v   Print the version number and exit',
        '  --help, -h      Print this help and exit',
        '',
        'Environment variables:',
        '  PORT            Port to listen on (default 3000)',
        '  HOST            Host to bind to (default localhost)',
      ].join('\n')
    );
    return;
  }

  log(`resume-agent v${PACKAGE_VERSION}`);
  const paths = ensureDataDir();
  setEnv(paths);
  runMigrations(paths.dataDir);
  ensureNativeVendorModules();
  startServer();
}

main();