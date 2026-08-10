#!/usr/bin/env node

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

// ---------------------------------------------------------------------------
// 包内路径（打包发布后，这个脚本位于 <package_root>/bin/resume-agent.js）
// ---------------------------------------------------------------------------
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const NEXT_DIR = PACKAGE_ROOT; // next start 需要在含有 .next 的目录下执行（或用 -C 指定）
const PRISMA_SCHEMA_PATH = path.join(PACKAGE_ROOT, 'prisma', 'schema.prisma');
// Prisma 7 reads datasource.url exclusively from this config file — the
// schema.prisma datasource block deliberately has no url. Passing --config
// explicitly (rather than relying on cwd-based auto-discovery) avoids any
// ambiguity from how different platforms/package managers lay out a global
// install's working directory.
const PRISMA_CONFIG_PATH = path.join(PACKAGE_ROOT, 'prisma.config.ts');
const PACKAGE_VERSION = require(path.join(PACKAGE_ROOT, 'package.json')).version;

const PORT = process.env.PORT || '3000';
const HOST = process.env.HOST || 'localhost';

function log(msg) {
  console.log(`[resume-agent] ${msg}`);
}

function fail(msg, err) {
  console.error(`[resume-agent] 错误: ${msg}`);
  if (err) console.error(err);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 第 1 步：定位 / 首次创建 ~/.resume-agent 数据目录
// ---------------------------------------------------------------------------
function ensureDataDir() {
  const dataDir = path.join(os.homedir(), '.resume-agent');
  const storageDir = path.join(dataDir, 'storage', 'resumes');

  for (const dir of [dataDir, storageDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      log(`已创建目录: ${dir}`);
    }
  }

  return { dataDir, storageDir, dbPath: path.join(dataDir, 'dev.db') };
}

// ---------------------------------------------------------------------------
// 第 2 步：设置 DATABASE_URL（相对路径的隐患就是从这里解决的——
// 不管用户从哪个 cwd 启动，DATABASE_URL 永远指向固定的用户级目录）
// ---------------------------------------------------------------------------
function setEnv({ dbPath, storageDir }) {
  process.env.DATABASE_URL = 'file:' + dbPath;
  // 如果应用代码里也用相对路径读写 storage/resumes，
  // 同样应该改成读这个环境变量，而不是拼 process.cwd()
  process.env.RESUME_STORAGE_DIR = storageDir;
  log(`DATABASE_URL = ${process.env.DATABASE_URL}`);
  log(`RESUME_STORAGE_DIR = ${process.env.RESUME_STORAGE_DIR}`);
}

// ---------------------------------------------------------------------------
// 第 3 步：跑迁移
//
// prisma migrate deploy 本身是幂等的：没有待应用的迁移时会直接快速返回，
// 不会重复执行已经跑过的迁移。所以这里选择"每次都跑一次"，
// 而不是自己维护一个"是否已迁移"的标记文件——
// 标记文件和数据库真实状态不同步（比如迁移中途失败）是一个更麻烦的故障模式。
//
// 如果你确实想跳过这次检查（比如追求毫秒级启动），可以改成：
//   const marker = path.join(dataDir, '.migrated');
//   if (!fs.existsSync(marker)) { ...跑迁移... fs.writeFileSync(marker, ''); }
// ---------------------------------------------------------------------------
function runMigrations() {
  if (!fs.existsSync(PRISMA_SCHEMA_PATH)) {
    fail(`找不到 Prisma schema: ${PRISMA_SCHEMA_PATH}\n打包时请确认 prisma/schema.prisma 已包含在发布包内。`);
  }
  if (!fs.existsSync(PRISMA_CONFIG_PATH)) {
    fail(
      `找不到 Prisma 配置文件: ${PRISMA_CONFIG_PATH}\n` +
        'datasource.url 是从这个文件读取的（schema.prisma 里没有写 url）——' +
        '打包时请确认 prisma.config.ts 已包含在发布包内（package.json 的 "files" 字段）。'
    );
  }

  log('检查并应用数据库迁移...');

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
    fail('执行 prisma migrate deploy 失败', result.error);
  }
  if (result.status !== 0) {
    fail(`prisma migrate deploy 以退出码 ${result.status} 结束`);
  }

  log('迁移检查完成。');
}

// ---------------------------------------------------------------------------
// 第 5 步：跨平台打开默认浏览器（不引入额外依赖）
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
    // 打不开浏览器不应该阻塞服务启动，提示一下让用户手动打开即可
    log(`无法自动打开浏览器，请手动访问 ${url}`);
  }
}

// ---------------------------------------------------------------------------
// 第 4 步：启动打包好的 Next.js 服务
// ---------------------------------------------------------------------------
function startServer() {
  const nextBin = require.resolve('next/dist/bin/next', { paths: [PACKAGE_ROOT] });

  if (!fs.existsSync(path.join(NEXT_DIR, '.next'))) {
    fail(`找不到构建产物 .next 目录: ${path.join(NEXT_DIR, '.next')}\n发布前请确认已执行 next build 并把 .next 打包进发行包。`);
  }

  log(`启动服务: http://${HOST}:${PORT}`);

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

  server.on('error', (err) => fail('启动 Next.js 服务失败', err));

  server.on('exit', (code) => {
    process.exit(code === null ? 1 : code);
  });

  // 服务是异步起来的，next start 打印出 "Ready" 前浏览器打开也没事，
  // 简单起见延迟一小段时间再打开，减少用户看到"无法访问此网站"的概率
  setTimeout(() => openBrowser(`http://${HOST}:${PORT}`), 1500);

  // 保证 Ctrl+C 能正确杀掉子进程
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
        '用法: resume-agent [选项]',
        '',
        '选项:',
        '  --version, -v   打印版本号并退出',
        '  --help, -h      打印本帮助并退出',
        '',
        '环境变量:',
        '  PORT            监听端口（默认 3000）',
        '  HOST            监听地址（默认 localhost）',
      ].join('\n')
    );
    return;
  }

  log(`resume-agent v${PACKAGE_VERSION}`);
  const paths = ensureDataDir();
  setEnv(paths);
  runMigrations();
  startServer();
}

main();