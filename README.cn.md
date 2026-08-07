# Resume Agent

一个个人、纯本地使用的简历定制工具。维护一份可复用的工作/项目经历素材库，通过和 AI 对话把它蒸馏成结构化、可量化的简历亮点，再针对某个具体的岗位 JD 生成一份单页 Typst 简历——AI 会自动压缩超出的部分、自动填充明显的空白，确保恰好一页。

全程在你自己的机器上运行，数据存在本地 SQLite 数据库里。没有账号系统，也不支持多用户——原因见 [`docs/technical-doc.cn.md`](./docs/technical-doc.cn.md#1-项目定位)。

(English version: [`README.md`](./README.md)。)

## 快速开始

### 方式 A —— 通过 npm 安装（推荐）

[`resume-agent`](https://www.npmjs.com/package/resume-agent) 已经发布到 npm，是一个开箱即用的 CLI：

```bash
npm install -g resume-agent
resume-agent
```

就这么简单。首次运行会自动创建 `~/.resume-agent/`（SQLite 数据库和保存的 PDF 都存在这里，跟你在哪个目录下敲这条命令无关）、自动应用数据库迁移、启动服务，并自动打开浏览器访问 `http://localhost:3000`。`Ctrl+C` 停止。想换端口/监听地址：`PORT=4000 HOST=0.0.0.0 resume-agent`。

运行前请先确保能访问 Claude——见下方"关于访问 Claude"。

### 方式 B —— 从源码运行（用于开发/贡献代码）

```bash
git clone https://github.com/Minghao-Han/Resume-Agent.git
cd Resume-Agent

# 1. 安装依赖（postinstall 会把 Typst 的 wasm 文件拷到 public/typst/ 下）
npm install

# 2. 指定本地 SQLite 数据库
echo 'DATABASE_URL="file:./dev.db"' > .env

# 3. 应用迁移、创建 dev.db、生成 Prisma Client
npx prisma migrate dev

# 4. 启动
npm run dev        # 开发模式，http://localhost:3000
# 或
npm run build && npm run start   # 生产模式，同样只在本机运行
```

### 关于访问 Claude

不管哪种方式，应用内都没有配置 Claude 凭证的设置页——依赖运行它的这台机器上已经配好的 Claude 访问方式，二选一：

- 本机已安装并登录 Claude Code CLI；或
- 设置了环境变量 `ANTHROPIC_API_KEY`（方式 B 的话，`.env` 或 shell 均可）。

**建议的初次使用流程**：模板编辑 → 个人信息 → 经历蒸馏 → 生成简历（并保存）→ 在历史简历中查看/修改。完整说明见 [`docs/user-manual.cn.md`](./docs/user-manual.cn.md)。

## 架构速览

Next.js（App Router）+ Prisma/SQLite，所有 AI 行为都由 Claude Agent SDK 驱动。

```
浏览器（客户端组件）
   │  通过 src/lib/apiClient.ts 发请求
   ▼
src/app/api/*                 路由处理器（Zod 校验入参）
   │                              │
   │                              ▼
   │                        src/lib/agent/*        每个请求一次性调用
   │                          core.ts                Claude Agent SDK，靠
   │                          starq.ts / resumeGen.ts / assistant.ts   `resume: sessionId` 续接
   │                          autoConverge.ts、templateCalibration.ts、...
   ▼
Prisma（better-sqlite3 adapter）──► dev.db（SQLite）
                                       + 磁盘上的 storage/resumes/*.pdf
```

- **页面**（`src/app/{experience,generate,resumes,templates,profile}`）：模板编辑 → 个人信息 → 经历蒸馏 → 生成简历 → 历史简历，另外还有一个全局挂载的悬浮"助手"聊天窗，它改的是这个仓库自己的 `.claude/CLAUDE.md`/`.claude/skills/`，而不是应用数据。
- **Agent 层**（`src/lib/agent/`）：每个功能（`starq.ts`、`resumeGen.ts`、`assistant.ts`）都是对 `core.ts` 的 `runAgentTurn` 做的一层很薄、范围很窄的封装，各自维护自己的 `canUseTool` 工具白名单和 `skills` 技能白名单，防止一个功能的 session 意外碰到别的集成的工具。简历生成额外经过 `autoConverge.ts`——它会对同一个 session 自动最多再追问 3 轮，直到收敛到"恰好一页、填充良好"。
- **Typst 编译**故意分了两套：客户端一套（`src/lib/typstClient.ts`，浏览器里跑 WASM）负责编辑器的实时预览；服务端一套（`src/lib/agent/typstServerCompile.ts`）负责自动收敛循环和模板校准在 API 路由里需要的、程序化的页数/填充率度量。
- **数据**：5 个 Prisma 模型（`PersonalInfo`、`Education`、`Experience`、`Highlight`、`ResumeTemplate`、`GeneratedResume`）存在 SQLite 里；数组/对象类型的字段都以 JSON 字符串形式存储。应用自己唯一持久化的"对话状态"就是 Claude Agent SDK 的 session ID——完整的对话记录其实存在 CLI 自己的本地会话存储里。

完整的架构、数据模型和实现细节（包括未保存修改检测机制是怎么做的）见 [`docs/technical-doc.cn.md`](./docs/technical-doc.cn.md)；逐功能的完整使用说明见 [`docs/user-manual.cn.md`](./docs/user-manual.cn.md)。
