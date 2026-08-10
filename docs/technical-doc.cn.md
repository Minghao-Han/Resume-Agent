# 技术文档

面向后续维护/接手这个项目的开发者。涵盖：整体架构、技术栈、以及若干关键机制的具体实现方式（尤其是"未保存修改检测"这类容易被问到、但代码里分散在好几个文件的细节）。

产品功能层面的说明见 [`user-manual.cn.md`](./user-manual.cn.md)。

---

## 1. 项目定位

个人、本地运行的全栈应用（Next.js + Prisma/SQLite），用于把一份 JD 定制成一页 Typst 简历。**单用户、无鉴权、无多租户**——`.claude/CLAUDE.md` 里明确写着这一点，Prisma schema 里也没有 `User` 模型，`PersonalInfo` 实质上是个单例表（代码里永远用 `findFirst`）。没有配置测试框架（无 jest/vitest/playwright）；`README.md`（本文档加入之前）曾是未修改过的 `create-next-app` 模板。

## 2. 技术栈

| 分类 | 依赖 | 版本 | 说明 |
|---|---|---|---|
| 框架 | `next` | 16.2.12 | App Router，只有 `src/app/`，无 `pages/` |
| | `react` / `react-dom` | 19.2.4 | |
| | `typescript` | ^5 | |
| DB / ORM | `prisma` / `@prisma/client` | ^7.9.1 | generator 输出到 `src/generated/prisma`（非默认位置） |
| | `@prisma/adapter-better-sqlite3` | ^7.9.1 | Prisma 7 的 driver adapter 模式，取代内置 query engine |
| AI / Agent | `@anthropic-ai/claude-agent-sdk` | ^0.3.220 | 全部 AI 能力都走这一个包；**没有**直接用 `@anthropic-ai/sdk`（原生 Messages API） |
| | `zod` | ^4.4.3 | API 路由入参校验 + agent 结构化输出校验 + MCP 工具 schema |
| 编辑器/高亮 | `@uiw/react-codemirror` | ^4.25.11 | CodeMirror 6 的 React 封装 |
| | `@codemirror/language` | ^6.12.4 | 仅用它的 `StreamLanguage`/`StreamParser` 搭自定义 Typst 高亮 |
| Typst 编译 | `@myriaddreamin/typst.ts` | ^0.7.0 | 浏览器端 `$typst` 单例封装 |
| | `@myriaddreamin/typst-ts-web-compiler` | ^0.7.0 | wasm 编译器二进制 |
| | `@myriaddreamin/typst-ts-renderer` | ^0.7.0 | wasm 渲染器二进制 |
| 样式 | `tailwindcss` / `@tailwindcss/postcss` | ^4 | v4 的 PostCSS 插件模式，无 `tailwind.config.js` |
| 其它 | `uuid` | ^14.0.1 | |
| | `dotenv` | ^17.4.2 | 仅 `prisma.config.ts` 显式引入，因为 Prisma CLI 上下文不走 Next.js 自己的 env 加载 |

**RSC 使用极少**：只有 `src/app/layout.tsx`（根布局）和 `src/app/page.tsx`（首页）是纯 Server Component；其余所有页面组件和共享组件都标了 `"use client"`。没有用 Server Actions，所有数据流都是"客户端组件 → `src/lib/apiClient.ts` → `src/app/api/*` 路由"这一条路径，没有走 RSC 的服务端数据获取。

## 3. 目录结构

```
src/app/                    App Router 页面 + API 路由
  experience/                「经历蒸馏」页
  generate/                  「生成简历」页
  profile/                   「个人信息」页
  resumes/                   「历史简历」页
  templates/                 「模板编辑」页
  api/
    assistant/               悬浮助手的对话接口（+ new-session, mentionables）
    experience/distill/      经历蒸馏的对话接口（+ new-session）
    experiences/[id]/        经历 CRUD
    profile/                 个人信息 CRUD
    resume/generate/         生成简历的对话接口（内部跑 autoConverge）
    resumes/[id]/            历史简历 CRUD（+ pdf 子路由）
    templates/[id]/          模板 CRUD（+ analyze 子路由）

src/components/              AssistantDrawer / ChatPanel / NavBar / ToastHost / TypstPreview

src/lib/                     跨功能工具：db.ts / apiClient.ts / apiError.ts /
                             defaultTemplate.ts / experienceApi.ts / toast.ts /
                             typstClient.ts / typstLanguage.ts / unsavedChanges.tsx /
                             useIsDarkMode.ts

src/lib/agent/               所有 Claude Agent SDK 相关逻辑
  core.ts                    最底层：runAgentTurn，封装 SDK 的 query()
  assistant.ts                悬浮助手
  starq.ts                    经历蒸馏（STAR-Q）
  resumeGen.ts                 简历生成
  autoConverge.ts               生成结果的自动收敛循环
  charRange.ts                   纯数学：模板容量估算
  templateCalibration.ts          模板"分析"功能
  templateSanitize.ts             生成前的模板脱敏替换
  typstOutput.ts / typstServerCompile.ts   服务端 Typst 编译与文本处理（无 SDK 调用）

prisma/                      schema.prisma + migrations/（8 个迁移）
.claude/                     CLAUDE.md（项目记忆）+ skills/（本工具自己的技能文档）
public/typst/                两个 wasm 二进制的拷贝目标（postinstall 生成，不进 git）
scripts/copy-typst-wasm.mjs  postinstall 脚本
storage/resumes/             已保存简历的 PDF 文件，按 <id>.pdf 平铺存放
```

## 4. 数据模型（`prisma/schema.prisma`）

| 模型 | 关键字段 | 说明 |
|---|---|---|
| `PersonalInfo` | name/phone/email/location/github/linkedin, `educations Education[]` | 实质单例（代码里始终 `findFirst`） |
| `Education` | school/degree/major/startDate/endDate/region/relevantCourses/gpa/sortOrder | `onDelete: Cascade` 挂在 `PersonalInfo` 下 |
| `Experience` | title/org/type/startDate/endDate/location/rawInput, `chatHistory String`（JSON 字符串）, `sessionId String?`, `highlights Highlight[]` | 一条 Experience 可以产出多条 Highlight（schema 注释明确说明） |
| `Highlight` | situation/task/action/result/quantify/resumeBullet, `tags String`（JSON 字符串数组）, sortOrder | `onDelete: Cascade` 挂在 `Experience` 下 |
| `ResumeTemplate` | name/typstSource, `isDefault Boolean`, `calibration String?`（JSON 字符串） | `calibration` 实际写入内容是 `{charRangeLow, charRangeHigh, realPageHeightPt, calibratedAt}`；schema 注释里描述的更复杂的形状是历史遗留/尚未实现的设想 |
| `GeneratedResume` | label/jdSource/jdIsUrl/company/targetRoleTag/typstSource, `selectedHighlightIds String`, `chatHistory String`, `sessionId String?`, `pdfPath String?` | |

**设计取舍**：所有需要存数组/对象的字段（`chatHistory`、`tags`、`selectedHighlightIds`、`calibration`）都用 `String` 存 JSON 序列化后的文本，而不是用 JSON 类型列——这是 SQLite + Prisma 常见的折衷写法，读写时手动 `JSON.parse`/`JSON.stringify`（每个用到的路由里都有一个本地 `serialize()` helper 做这件事，`src/app/api/resumes/route.ts`、`src/app/api/resumes/[id]/route.ts` 里各自重复了一份，未抽取公共模块）。

## 5. Claude Agent SDK 会话机制

### 5.1 最底层：`runAgentTurn`（`src/lib/agent/core.ts`）

```
PROJECT_ROOT = process.cwd()   // 作为每次调用的 cwd，让 SDK 能加载本仓库自己的
                                // .claude/CLAUDE.md 和 .claude/skills/
```

`runAgentTurn(prompt, options)` 调用 SDK 的 `query({ prompt, options })`。关键点：

- 这是"**每个 HTTP 请求对应一次一次性的 SDK 调用**"的模型——不是长连接、不是常驻进程里的多轮状态机。SDK 会 spawn 或复用本机的 Claude Code CLI 子进程，"蹭"用户本机已登录的订阅账号。
- 多轮对话的状态**不存在这个 Node 进程里**，而是活在 Claude Code CLI 自己的本地会话存储里（"each call is a short-lived subprocess, so multi-turn state lives in the CLI's own on-disk session store, not in this Node process" —— `core.ts` 原文注释）。续接靠传 `options.resume = sessionId`；应用自己的数据库/前端状态，**只存这个不透明的 sessionId 字符串**，从不在本地重放消息历史。
- 并发：由于每次调用是独立子进程、以 `sessionId` 区分，不同 session 之间天然隔离；但代码里**没有对同一个 sessionId 的并发请求做互斥/排队**——因为这是单用户本地工具，默认不会有这种竞态场景。
- 错误处理：整个 async generator 消费过程包在 try/catch 里，把子进程层面的异常（鉴权失败、速率限制、崩溃）统一转成 `{ isError: true }`，保证 API 路由永远能返回合法 JSON，不会抛出未处理的异常。
- `permissionMode: "default"` 在每个业务模块里都显式设置——因为这是个无人值守的后端调用，没有 UI 能弹出权限确认框，所有工具调用的允许/拒绝必须完全靠 `canUseTool` 用代码判断完，见下节。

### 5.2 各业务模块如何在 `core.ts` 之上组合

| 模块 | 用途 | system prompt | skills 白名单 | 工具白名单（canUseTool） |
|---|---|---|---|---|
| `assistant.ts` | 悬浮助手，改 `.claude/` 下的文件 | Claude Code 官方 preset + 追加说明 | 不设（靠 `settingSources` 让它能发现所有 skill） | `Read/Write/Edit`（路径必须在 `.claude/` 内）+ 自定义 MCP 工具 `delete_claude_file` |
| `starq.ts` | 经历蒸馏对话 | 自定义 system prompt | `resume-highlight-extraction`、`star-q-extraction`、`resume-bullet-writing` | 仅 `mcp__starq__submit_highlights` + `Skill` |
| `resumeGen.ts` | 简历生成对话 | 自定义 system prompt，`model` 固定为 `claude-haiku-4-5-20251001`，`thinking: {type:"disabled"}` | `resume-content-and-jd-reading`、`resume-one-page-fitting`、`resume-generation`、`resume-bullet-writing` | 仅 `WebFetch/Skill/StructuredOutput` |
| `autoConverge.ts` | 生成结果的自动多轮收敛 | 不直接调用 `core.ts`，而是复用 `resumeGen.ts` 的 `continueResumeGeneration` | — | — |
| `charRange.ts` | 纯数学（容量估算） | 不涉及 SDK，刻意做成零依赖，避免 `templateCalibration.ts` 和 `resumeGen.ts` 之间循环引用 | — | — |
| `templateCalibration.ts` | 「分析模板」功能 | 编排 `resumeGen.ts` + `autoConverge.ts` + `typstServerCompile.ts` + `charRange.ts`，直接读写 `prisma.resumeTemplate` | — | — |
| `typstServerCompile.ts` / `typstOutput.ts` | 服务端 Typst 编译与文本清理 | 不涉及 SDK | — | — |

**为什么 `resumeGen.ts` 把模型钉死在 `claude-haiku-4-5-20251001` 并关掉 thinking**：文件内注释记录了一次真实的对比测量——不钉版本/开 thinking 时单轮 6900-9500 输出 tokens、耗时 70-110 秒；关掉之后单轮约 1800 tokens、约 20 秒。这是一个刻意的延迟/成本优化，不是默认行为。

### 5.3 `canUseTool`：为什么必须存在

这是全项目最重要的一条安全注释，出自 `resumeGen.ts`：

> `tools`/`allowedTools` 只能限制 Claude Code **自带**的工具，**限制不了**通过 `settingSources` 继承进来的 MCP server 工具。曾经实测过：只设了 `tools: ["WebFetch", "Skill"]`、没设 `canUseTool` 的情况下，一次真实的生成调用直接调用了 `mcp__claude_ai_Google_Drive__create_file`，试图把简历写进用户真实的 Google Drive——而这和这个"窄用途" session 完全无关，本不该能碰到。

因此每个业务模块都自己实现一个**默认拒绝（default-deny）的白名单** `canUseTool`，而不是尝试去"拉黑"所有已知的 MCP server——因为用户以后新装的任何 MCP 集成，若不用默认拒绝的思路，都会被无声地暴露给这些窄用途 session。三个模块的具体范围见上表最后一列。

### 5.4 skills 白名单机制

`skills: string[]` 是 SDK 提供的选项，用来限定这次 session 只能"看到"并通过 `Skill` 工具调用列出的这几个技能——不是"user 全局的 `~/.claude/skills`"或"Claude Code 自带技能"，而是精确限定到这个工具自己 `.claude/skills/` 下的、和当前任务相关的那几份。`STARQ_SKILLS`/`RESUME_GEN_SKILLS` 常量各自列出了自己需要的技能名；`assistant.ts` 不设这个选项，因为它本身的职责就是管理 `.claude/skills/` 目录，需要能发现全部技能。

`/api/assistant/mentionables` 路由则是**完全独立**的另一套逻辑：直接扫描磁盘上 `.claude/skills/` 目录（同时支持 `<name>/SKILL.md` 目录型和 `<name>.md` 扁平型两种布局），给悬浮助手的 `@` 自动补全提供候选列表——它和上面 SDK 的 `skills` 白名单没有直接关系，只是恰好都在读同一个目录。

## 6. Typst 编译：为什么客户端和服务端各有一套

| | 客户端 (`src/lib/typstClient.ts`) | 服务端 (`src/lib/agent/typstServerCompile.ts`) |
|---|---|---|
| 运行环境 | 浏览器（`"use client"`） | Node（API 路由内） |
| wasm 来源 | 静态文件 `/typst/*.wasm`（`postinstall` 拷贝进 `public/typst/`） | 直接从 `node_modules/@myriaddreamin/...` 磁盘路径读取 |
| `@preview/...` 包解析 | 通过 `TypstSnippet.fetchPackageRegistry()`，走浏览器原生 `fetch` | 用 `execFileSync` **同步**调用 `curl` —— 原因见下 |
| 用途 | `/generate`、`/templates`、`/resumes` 里 `TypstPreview` 组件的实时预览；客户端触发的 PDF 下载/上传 | `autoConverge.ts` 的收敛循环、`templateCalibration.ts` 的模板分析、`/api/resume/generate` 路由——这些都跑在没有浏览器/DOM 的 API 路由里，需要程序化地拿到页数/填充率这类度量 |

**为什么服务端解包用同步 `curl` 而不是 `fetch`**：源码注释解释——Typst 编译器的 `PackageRegistry.resolve` 回调是从 wasm 模块内部**同步**调用的，而原生 `fetch` 永远是异步的，没法直接塞进这个同步回调里，所以退而求其次用 `execFileSync` 跑一个子进程 `curl`。

服务端编译器额外提供了几个客户端没有的度量函数：
- `countBodyChars`：给容量校准用的字数代理指标；
- `insertAutoHeightOverride` + `measureAutoHeight`：在模板声明之后插入 `#set page(height: auto)`，无视原本的分页限制，测出内容**真实**需要多高（哪怕已经溢出了原本的一页）；
- `measureRealPageHeight`：用一份几乎空的占位内容、按模板真实的纸张设置编译一次，反推出真实页高（单位 pt）——因为像 `paper: "us-letter"`这种参数是传给某个 import 进来的包函数的，从源码文本本身根本看不出实际页高是多少。

## 7. PDF 存储

`src/app/api/resumes/[id]/pdf/route.ts`：

- `PUT`：接收客户端已经编译好的 PDF 原始字节（`ArrayBuffer`），写入 `storage/resumes/<id>.pdf`，并把这个绝对路径记录进 `GeneratedResume.pdfPath`。
- `GET`：按 `pdfPath` 读文件，以 `application/pdf` 流式返回，`Content-Disposition` 里的文件名固定写死成 `"resume.pdf"`——因为这个响应头的 `filename=` 只能是 Latin-1/ByteString，没法直接放中文标签。
- 删除一条历史简历时会尝试 `unlink` 对应的 PDF 文件（best-effort，失败也不影响数据库记录的删除）。

## 8. 自动收敛算法（`src/lib/agent/autoConverge.ts`）

**常量**：`MAX_AUTO_ROUNDS = 3`（首轮之外最多再修正 3 轮）、`MIN_FILL_RATIO = 0.9`（收敛的下限）、`TARGET_FILL_RATIO = 0.95`（修正时的目标，故意留一点余量，不卡在临界值上）。

**每一轮怎么打分**（`checkFit` → `distanceToConverged`）：

1. 服务端真正编译一次，拿到 `pageCount`；
2. 用 `measureAutoHeight` 测出"不限制分页"时内容实际需要的高度，除以真实页高得到 `fillRatio`（这个值可以大于 1，代表溢出了多少）；
3. 用 `countBodyChars` 数一下正文字符数。

打分规则（越小越好）：`pageCount !== 1` 一律判定很差（`1000 + pageCount`，溢出页数越多分越差）；单页但 `fillRatio` 未知记 `500`；单页且 `fillRatio >= 0.9` 记 `0`（已收敛）；单页但没填满，记 `0.9 - fillRatio`（越接近 0.9 越好）。**任何"单页"的结果都一定比任何"溢出"的结果分数更好**。

**循环本身**（`runConvergenceLoop`）：从第一轮结果开始，只要还没收敛、还有剩余轮次、且上一轮没出错，就：

- 根据是溢出还是欠填，发一条"请压缩到一页"或"请填充空白"的修正消息给同一个 session（`resume: sessionId` 续接），消息里会带一个基于**本轮**数据换算出来的目标字数（`charCount / fillRatio * TARGET_FILL_RATIO`——逻辑是"如果这么多字撑出了这个填充率，那么填充率恰好是 100% 时大概需要多少字"）；
- 把新一轮的结果和打分都记下来，继续判断是否收敛。

**最终选哪一轮**：遍历所有轮次的打分，取分数最小的那一轮，**不是简单取最后一轮**——因为修正有可能"矫枉过正"（比如为了压缩到一页反而删过头，或者为了填满反而溢出到第二页），所以要显式比较。前端会把每一轮都作为对话消息展示出来（非首轮会加"自动调整："前缀），这样用户能看到中间过程，即使最终采用的不是最后一条。

`charRange.ts` 的 `estimateTargetCharCount` 是另一套独立逻辑，只在**生成前**、构造第一轮 prompt 时用一次，依据的是模板的历史校准区间（`{charRangeLow, charRangeHigh}` 的中点，或只有单边已知时按 1.15/0.85 系数外推），和上面这个"每轮根据实际数据现算"的逻辑完全独立，不要混为一谈。

## 9. 模板校准与脱敏

- **校准**（`templateCalibration.ts`）：`analyzeTemplate` 拿一份内置的、内容比较丰富的虚构数据（`FAKE_PERSONAL_INFO`/`FAKE_EXPERIENCES`/`FAKE_JD`）跑一次**真实**的生成 + 收敛循环，把每一轮真实测得的 `(charCount, fillRatio, pageCount)` 都喂给 `charRange.ts` 的 `narrowRange`（不只取最后一轮），逐步收窄这个模板"一页大概能装多少字"的区间估计，连同一次性测出的 `realPageHeightPt` 一起存进 `ResumeTemplate.calibration`。重复点"分析"是在已有区间基础上继续收窄，不是每次都推倒重来。
- **脱敏**（`templateSanitize.ts`）：在模板源码真正进入生成 prompt 之前，用正则把形如 `#let name = "..."` 这类变量绑定，按变量名（`name/fullname/author`、`email/mail`、`phone/tel/mobile`、`location/address`、`github`、`linkedin`、`website/homepage/portfolio/twitter`）机械替换成当前登录用户的真实个人信息（或置空）。做这一层的原因：用户经常会拿一份"已经填过别人真实信息"的模板直接用，而"每次都指望模型自己记得要把这些替换掉"在实测中不够可靠，所以加了这层确定性的兜底，不完全依赖 prompt。

## 10. 未保存修改（unsaved changes）检测机制

完整实现在 `src/lib/unsavedChanges.tsx`。

**整体设计**：全局只有**一个** `UnsavedChangesContext`（`{isDirty, setDirty}`），而不是每个页面各自维护一份——原因是"同一时间只会有一个页面挂载着（普通的路由跳转会先卸载上一个页面），所以一个共享的全局标志位就够用了"（源码注释原话）。

**页面怎么上报"脏"状态**：每个页面自己算出一个 `isDirty` 布尔值，通过 `useReportDirty(isDirty)` 这个 hook 上报——内部是一个 `useEffect`，值变化时调用 `setDirty(isDirty)`，**组件卸载时无条件调用 `setDirty(false)`**（防止离开页面时忘记清掉标志位）。

**四个页面各自怎么算 `isDirty`（写法并不统一，取决于该页面状态的形状）**：

| 页面 | 判断方式 |
|---|---|
| `/generate` | `typstSource !== "" && typstSource !== savedTypstSnapshot` —— 纯字符串比较，且显式排除"还没生成过、初始空字符串"这种假阳性 |
| `/templates` | `name !== savedSnapshot.name \|\| source !== savedSnapshot.source` —— 对一个 `{name, source}` 快照对象逐字段比较 |
| `/profile` | `!loading && JSON.stringify(profile) !== JSON.stringify(savedSnapshot)` —— 整个对象 `JSON.stringify` 后比较，用 `!loading` 防止首次拉取数据完成前被误判为"脏" |
| `/experience` | `JSON.stringify(current) !== JSON.stringify(savedSnapshot)` —— 和 `/profile` 同样的整体 JSON 比较写法 |

**实际拦截行为分两层**：

1. **整页刷新/关闭/地址栏跳转**：`UnsavedChangesProvider` 挂了一个真正的 `window.addEventListener("beforeunload", ...)`——`isDirty` 为真时 `preventDefault()` 并把 `e.returnValue` 设成空字符串（浏览器会自己展示统一措辞的确认框，弹窗文案本身是各浏览器自己控制的，不受这里传的字符串内容影响，这里只是 Chrome 要求必须赋值这个字段）。
2. **应用内的客户端路由跳转**：**没有**在路由层面做拦截（没有包一层 `router.push`，也没有用 Next.js 的导航守卫钩子）。而是纯手工的"context + `confirm()`"模式——`NavBar.tsx` 里的 `go(href)` 函数在真正调用 `router.push(href)` 之前，先读一次 `useUnsavedChanges()` 里的 `isDirty`，是的话弹 `confirm(UNSAVED_CHANGES_MESSAGE)`，用户点取消就 `return` 不跳转。这**只覆盖通过 `NavBar` 自身按钮发起的跳转**（不过目前全站的导航入口确实也只有 `NavBar`）。各页面自己内部的"危险操作"（切换到别的模板/经历、发起重新生成）也各自在触发前手动 `confirm()` 同一句提示语，属于同一套模式的局部复用，不是自动生效的。

`UNSAVED_CHANGES_MESSAGE` 是写死的中文字符串：`"有未保存的修改，离开后将会丢失，确定要离开吗？"`。

## 11. 其它值得记录的机制

**Session ID 存哪：数据库列 vs. localStorage**——`Experience.sessionId`、`GeneratedResume.sessionId` 都存成数据库字段，因为这两类对话都绑定着一条具体的、永久的数据记录（某条经历的蒸馏对话、某份简历的定制对话），只要这条记录还在，就应该能在任何时候重新打开、无缝续接。悬浮助手则相反——它不属于任何一条具体数据，是一个跨页面的全局小工具，所以它的 `{sessionId, messages}` 存在浏览器 `localStorage`（key: `resume-agent:assistant-drawer`），另外还单独存了一个 `resume-agent:assistant-drawer-y` 记录它被拖拽到的垂直位置。

**Typst 语法高亮**（`src/lib/typstLanguage.ts`）——明确是一个轻量的手写 tokenizer，不是完整语法解析：基于 `@codemirror/language` 的 `StreamLanguage.define`，状态只跟踪"是否在块注释里"这一个标志位。能识别：块/行注释、行首 `=` 开头的标题、字符串、`$...$` 数学（不处理嵌套 `$`）、`` `代码` `` raw span、`<label>`、`@citation`、`#`（代码模式入口，标成 keyword）、带 Typst 单位后缀的数字（`pt/em/cm/mm/in/fr/deg/rad/%`）、固定关键字集合（`let/set/show/import/include/if/else/for/while/return/break/continue/in/not/and/or/none/auto/true/false/as/context`），以及 `*粗体*`/`_斜体_`。源码自己的注释也承认"不是完整语法，只是刚好够让模板编辑器可读"。

**深色模式检测**（`src/lib/useIsDarkMode.ts`）——纯靠 `window.matchMedia("(prefers-color-scheme: dark)")`，挂载时读一次、之后监听 `change` 事件保持同步；**没有**手动切换按钮，也不往 `<html>` 上加/删 class。`TypstPreview`、CodeMirror 实例这类不方便用 Tailwind `dark:` 类名的地方，直接用这个 hook 返回的布尔值选主题；页面里其它普通元素仍然走 Tailwind 自己的 `dark:` 变体（同样是跟随系统的 `prefers-color-scheme`，没有引入 `next-themes` 之类的库）。

**错误处理约定**——服务端 `src/lib/apiError.ts` 的 `errorResponse(err)`：`ZodError` 转成 `{error: "Invalid request", issues}`、400；其它一律 `{error: message}`、500——保证 API 路由永远返回合法 JSON，不会让 Next.js 默认的 HTML/空响应漏到前端。客户端 `src/lib/apiClient.ts` 的 `parseJsonResponse` 先读成文本再 `JSON.parse`，解析失败或 `!res.ok` 时统一抛出可捕获的 `ApiError`（尽量带上服务端返回的 `error` 字段作为消息），所有 `apiGet/apiPost/apiPut/apiDelete/apiPutBinary` 调用方都可以用 `err instanceof ApiError` 判断是不是一个"预期内"的业务错误。

## 12. 测试与部署

- 当前**没有配置任何测试框架**（无 jest/vitest/playwright，无 `*.test.ts`），`package.json` 的 `scripts` 只有 `dev/build/start/lint/postinstall`。
- 部署形态：本机 `next dev`（开发）或 `next build && next start`（生产模式，但仍是本机单进程），不是为多用户/云端部署设计的——没有鉴权、没有按用户隔离数据。
- 另外也以全局 npm 包的形式发布（`npm install -g resume-agent`）——具体怎么打包见下面第 13 节。

## 13. npm CLI 打包

`resume-agent` 除了跑源码，还基于同一份代码打包成了一个开箱即用的 npm CLI。几个关键点：

- **`bin/resume-agent.js`**（`package.json` 的 `bin` 字段指向它）是 npm 链接到 `PATH` 上的入口。每次启动都会：定位/首次创建 `~/.resume-agent/`（内含 `~/.resume-agent/storage/resumes/`）、把 `DATABASE_URL` 和 `RESUME_STORAGE_DIR` 这两个环境变量指到这里、跑一次 `prisma migrate deploy`（幂等，所以选择"每次都跑"而不是靠一个"是否已迁移"的标记文件——标记文件和数据库真实状态不同步，比如迁移中途失败，是个更麻烦的故障模式），然后对着包里自带的 `.next` 构建产物启动 `next start`，并自动打开默认浏览器。
- **为什么要把 spawn 出来的 server 进程的 `cwd` 强行钉死在包根目录**：`next start <dir>` 并**不会** `process.chdir()`——它只是把 `<dir>` 用来定位构建产物，不影响进程本身的当前目录。如果不显式在 `spawn()` 时传 `cwd: PACKAGE_ROOT`，这个 server 进程就会继承用户敲 `resume-agent` 命令时所在的那个目录，而 `src/lib/agent/core.ts` 里的 `PROJECT_ROOT = process.cwd()` 就会指向错误的地方——结果是**默默地**找不到 `.claude/CLAUDE.md`/`.claude/skills/`（不会报错崩溃，只是所有 AI 功能都会丢失行为定制，退化成通用回答）。这是 v0.1.0 首次发布之后才发现的真实 bug，修复方式就是在 `bin/resume-agent.js` 的 `spawn()` 调用里加上 `cwd` 选项。
- **`RESUME_STORAGE_DIR`**：`src/app/api/resumes/[id]/pdf/route.ts` 里的 `STORAGE_DIR` 现在会读这个环境变量（读不到时退回旧的、相对 `process.cwd()` 的路径，兼容本地 `npm run dev`），这样已保存简历的 PDF 就会稳定落在 `~/.resume-agent/` 这个固定目录，不管用户在哪个目录敲的命令——这一处也是在同一次 v0.1.0 发布之后才补上的，原因和上一条一样：这段代码原本是按"cwd 就是仓库根目录"这个假设写的，一旦这个应用能以装好的 CLI 形式从任意目录启动，这个假设就不再成立了。
- **`package.json` 的 `files` 字段**精确控制打包进 tarball 的内容：`bin`、一份**生产环境**的 `.next` 构建产物（显式排除了 `.next/dev` 和 `.next/cache`，原因见下一条）、`prisma`（迁移文件 + schema）、`public`（Typst 的 wasm 二进制）、`scripts`、生成好的 `src/generated/prisma` client，以及 `.claude/CLAUDE.md` + `.claude/skills`（但故意**不**包含 `.claude/settings.json`——那是仓库本地的 worktree 隔离开发配置，对终端用户没有意义）。
- **`prepublishOnly`: `rm -rf .next && next build && prisma generate`**——保证每次发布前都是一次干净的生产构建、Prisma Client 也是现生成的，这样本地残留的 `.next`（比如里面还留着 `next dev`/Turbopack 的开发缓存）就不可能混进发布包里。加上这一条的起因是：第一次 `npm pack` 生成了一个 **336 MB** 的 tarball——光是 `.next/dev/cache`（Turbopack 的持久化开发缓存）就占了未压缩内容约 530 MB 里的约 407 MB；靠 `files` 字段排除掉 `.next/dev` 和 `.next/cache` 之后，`.next` 真正的体积降到了约 22 MB（也就是真实的 `.next/server`/`.next/static`/`.next/build` 生产产物）。
- **`prisma.config.ts` 必须一起发布，而且要显式指定路径**：这个项目 `schema.prisma` 里的 `datasource db { }` 块故意没有写 `url`——在 Prisma 7 下，datasource 的 URL 完全是从 `prisma.config.ts` 的 `defineConfig({ datasource: { url: env("DATABASE_URL") } })` 里读的。`prisma.config.ts` 放在仓库根目录，不在 `files` 字段原本列出的任何一个路径下，所以 v0.1.0 发布时根本没把它打进去——结果是所有平台（不分 Windows/macOS/Linux）上 `prisma migrate deploy` 都会报错 `The datasource.url property is required in your Prisma config file`。修复方式：把 `prisma.config.ts` 加进 `files`，并且让 `bin/resume-agent.js` 在跑 `migrate deploy` 子进程时显式传 `--config <绝对路径>`，而不是依赖 Prisma 基于 cwd 的自动发现。
- **npm 发布时会无条件剔除包里任何一个名字叫 `node_modules` 的目录——不管在哪一层，也不管 `files` 字段怎么写。** Turbopack 的生产构建会把一些没法直接打进 JS chunk 的依赖（原生插件如 `better-sqlite3`，以及 `@prisma/client`）单独 trace 出来，物理复制一份到 `.next/node_modules/<内容哈希>/`，编译产物里用这个哈希名去 `require()` 它，靠 Node 正常的 `node_modules` 查找规则把这个目录当成 requiring chunk 的祖先目录去找到。由于 `files` 字段根本压不住 npm 这条硬编码的 `node_modules` 排除规则，`.next/node_modules` 会在每次发布时被无声剔除——不管 `files` 怎么写都没用——结果是服务一收到第一个碰数据库的请求就崩，报 `Cannot find module '<哈希名>'`。同样是所有平台都会中招，也是先从一位 Windows 用户的报告里发现的。修复方式是一套"打包时搬走、运行时搬回"的组合拳：`scripts/relocate-next-native-deps.mjs` 在 `prepublishOnly` 里把 `.next/node_modules` 改名成 `.next/vendor`（npm 不会动这个名字），`bin/resume-agent.js` 的 `ensureNativeVendorModules()` 则在用户机器上 `resume-agent` 第一次启动、真正开服务之前，把它改名改回 `.next/node_modules`。

## 14. 已知的技术债 / 值得关注的点

- `serialize()`（JSON 字段反序列化 helper）在 `src/app/api/resumes/route.ts` 和 `src/app/api/resumes/[id]/route.ts` 里各自复制了一份，没有抽到公共模块。
- `ResumeTemplate.calibration` 字段的 schema 注释描述的形状（`{intercept, perEntry, perBullet, perChar, ...}`）和实际写入的形状（`{charRangeLow, charRangeHigh, realPageHeightPt, calibratedAt}`）不一致，注释像是早期设计遗留，未同步更新。
- 同一个 `sessionId` 理论上可能被并发请求同时续接（比如用户手快连点两次"重新生成"），代码里没有互斥保护——单用户场景下概率低，但不是完全不可能触发。
