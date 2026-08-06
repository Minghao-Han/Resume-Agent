# User Manual

Resume Agent is a **personal, local-use** resume-tailoring tool: it keeps a reusable library of your experience/highlights, and generates an AI-assisted, one-page Typst resume tailored to a specific job description. It runs entirely on your own machine; your data lives in a local SQLite database.

This manual has two parts:

- **Part 1: Quick Start** — how to install, and the full recommended flow from zero to your first generated resume.
- **Part 2: Detailed Feature Guide** — what each page does, how experience distillation works, how to refine a resume via AI chat, plus a short list of current known limitations.

(中文版见 [`user-manual.cn.md`](./user-manual.cn.md)。)

---

# Part 1: Quick Start

## 1. Installation

```bash
# 1. Install dependencies (postinstall automatically copies the Typst wasm files
#    into public/typst/)
npm install

# 2. Configure the database connection — create a .env file at the repo root:
echo 'DATABASE_URL="file:./dev.db"' > .env

# 3. Initialize the database (applies every migration under prisma/migrations,
#    creates dev.db, and generates the Prisma Client into src/generated/prisma)
npx prisma migrate dev

# 4. Make sure Claude access is available — see note below
# 5a. Local development
npm run dev
# 5b. Or build then run in production mode
npm run build && npm run start
```

Listens on `http://localhost:3000` by default.

**About Claude access**: every AI feature in this app goes through the [Claude Agent SDK](https://docs.claude.com), which talks to a local Claude Code CLI process. You need **one of the following**:

- The Claude Code CLI installed and already logged in on this machine (using your own Claude subscription); or
- An `ANTHROPIC_API_KEY` environment variable set (either in `.env` or your shell environment).

There's no in-app "enter your API key" settings page — this is a personal local tool, so it trusts however Claude access is already configured on the machine running it.

> No `.env.example` file exists, and no minimum Node version is declared by this app itself; the Claude Agent SDK itself requires Node ≥ 18.

## 2. Recommended Workflow

Following this order is the complete path to actually using the tool:

```
① Edit a resume template → ② Fill in personal info → ③ Distill your experience → ④ Generate & save a resume → ⑤ Preview/edit it in history
      Templates                    Profile               Experience Distillation      Generate Resume            Resume History
```

### ① Start with a resume template (page: "Templates")

Open the Templates page and edit the Typst source in the left pane (with syntax highlighting) — the right pane compiles a live preview. Once it looks right, click **"保存为模板" (Save as Template)**.

- You can keep multiple templates; the top-right **"新建" (New)** button resets to a blank skeleton.
- **"分析模板" (Analyze Template)** has the AI run one full generation pass against built-in placeholder sample data to estimate roughly how much text this template's single page can hold — later, real generation uses that estimate as a loose sizing hint (not a hard rule). The template must be saved before you can analyze it, since analysis runs against the saved version.

> Known limitation: there's currently no UI to mark a template as the "default" one, even though the database and API already support that field.

### ② Fill in your personal info (page: "Profile" / 个人信息)

Name, phone, email, location, GitHub, LinkedIn, plus any number of education entries (add/remove individually). This information gets written into the corresponding spots in the template at generation time — even if the template you're using already has someone else's (or placeholder) name/email hardcoded into it, the system mechanically replaces it with what you've filled in here, rather than relying entirely on the AI to "remember" to swap it out.

Click **"保存" (Save)** when done.

### ③ Distill your experience (page: "Experience Distillation" / 经历蒸馏)

This is the core step of the whole tool: turning a raw description of an internship/project into one or more structured, quantified resume highlights, through a conversation with the AI.

1. Click "+ 新建经历" (+ New Experience), fill in title, company/project name, type (internship/project), start/end dates, and location.
2. Paste the full raw description of that experience into the big textarea, then click **"提取 Highlights" (Extract Highlights)**.
3. The AI splits this experience into one or more highlights (**a single experience can genuinely contain several independent highlights** — e.g. one internship that covered a security fix, a system-design project, and an incident response would each become their own entry). Each highlight has Situation / Task / Action / Result / Quantify (push for a real number — the AI will ask rather than invent one) and a polished Resume Bullet, plus 2–5 role tags.
4. Keep chatting in the right-hand panel to have the AI adjust a highlight, add detail, or rephrase something.
5. When you're happy, click **"保存" (Save)** at the bottom of the left column — note that everything extracted so far only exists on the page; **it isn't written to the database until you click Save**.

Conversation tricks (e.g. how to precisely target "only edit highlight #3") are covered in Part 2.

### ④ Generate & save a resume (page: "Generate Resume" / 生成简历)

1. Pick a template.
2. Paste the JD text (or paste a JD URL directly — the system auto-detects whether it's a URL and has the AI fetch the page itself).
3. Click **"生成简历" (Generate Resume)**. The AI reads all your saved experience highlights, picks the ones that best match this JD, and generates a Typst resume, with a live-compiled preview on the right.
4. After generation, you can keep chatting to refine it (e.g. "make that bullet more quantified," "rephrase this to emphasize my concurrency experience"), or click **"重新生成" (Regenerate)** to start over entirely.
5. If the compiled result runs over one page, a banner appears with **"自动压缩到一页" (Auto-compress to One Page)**; if there's noticeably empty space on one page, you'll see **"自动填充更多内容" (Auto-fill More Content)**.
6. Once you're satisfied:
   - **"下载 PDF" (Download PDF)**: just compiles the current content to a PDF and downloads it to your machine — nothing is saved to history.
   - **"保存" (Save)**: persists this resume into "Resume History" and also compiles and stores a PDF. **A resume only shows up in Resume History once you click Save.**

### ⑤ Review and edit it in "Resume History" (历史简历)

Open the Resume History page to see every saved resume as a card. Click **"预览" (Preview)** to open a large preview; click **"编辑" (Edit)** to expand a Typst source editor to the left of the preview for quick manual tweaks — click **"保存" (Save)** to overwrite that history entry (recompiling and replacing the corresponding PDF file too).

---

# Part 2: Detailed Feature Guide

## Page Overview

Top navigation bar (visible on every page):

| Nav label | Route | Purpose |
|---|---|---|
| 经历蒸馏 (Experience Distillation) | `/experience` | Turn raw experience text into structured, quantified resume highlights via AI conversation |
| 生成简历 (Generate Resume) | `/generate` | Pick the right highlights for a specific JD and generate/polish a one-page Typst resume |
| 历史简历 (Resume History) | `/resumes` | Browse, preview, download, edit, and delete every saved resume |
| 模板编辑 (Templates) | `/templates` | Author/maintain Typst resume templates, optionally run "capacity analysis" |
| 个人信息 (Profile) | `/profile` | Name/contact info/education and other base info |

The home page `/` is just entry cards for these same five features, equivalent to clicking the nav bar.

There's also a **floating circular "AI" button** on the right edge of every page (draggable vertically), which opens an independent "assistant" chat window — see "Floating Assistant" below.

## Experience Distillation (STAR-Q Extraction) in Detail

### Full flow

1. Fill in the basics (title/company/type/dates/location), paste the raw experience text, click "提取 Highlights" (Extract Highlights).
2. The backend requires the AI to submit a **complete** current list of highlights (never a diff) in every single reply, so you always see the latest full result.
3. Each highlight contains:
   - **Title**: a short name for this achievement
   - **Situation / Task / Action / Result**: standard STAR
   - **Quantify**: the result restated with a number — if the source text has no number, the AI will ask you for one rather than inventing it
   - **Resume Bullet**: a polished, single-sentence synthesis of the above (not the raw fields concatenated)
   - **Tags**: 2–5 role tags (e.g. "backend," "security," "data science")
4. A single experience is often split into **multiple independent highlights** — e.g. the security fix, the system-design project, and the incident response from the same internship would each become their own entry, rather than being crammed into one long, unfocused bullet.

### Using @ to precisely target one highlight

The chat panel on the right supports typing `@` to mention a specific already-extracted highlight (autocomplete lists the titles of all current highlights). When you send a follow-up message with one or more highlights @mentioned, the system explicitly tells the AI: "this request applies only to the mentioned one(s) — every other highlight must be preserved exactly as-is." If nothing is @mentioned, the AI uses its own judgment to figure out which highlight (if any) the request refers to, or whether it's a general request (e.g. "add one more").

This is currently the **only** chat scenario that supports precise, targeted edits (the Generate Resume page's chat does not have this @ feature — see below).

### Manual editing

Beyond chat, each highlight card can also be edited by hand directly:
- "展开 STAR-Q" (Expand STAR-Q) reveals editable fields for Situation/Task/Action/Result/Quantify individually;
- The Resume Bullet field is always an editable textarea;
- Tags can be added/removed one at a time;
- "+ 手动添加一条" (+ Add Manually) appends a fully blank highlight, and "删除" (Delete) removes one.

### Clearing chat history

There's a **"清空历史" (Clear History)** button at the top of the chat panel: it clears the currently displayed chat log *and* actually ends the underlying AI session (not just hiding messages — the next message truly starts a fresh conversation, with the AI no longer "remembering" anything from before). **Already-extracted highlights are not affected** — the two are entirely separate.

### Remember to save

Whether from chat extraction, manual edits, or clearing chat history — all of it only happens locally on the page. Only clicking **"保存" (Save)** at the bottom of the left column actually persists it to the database. Switching to a different experience, or leaving the page, with unsaved changes prompts a confirmation dialog.

## Resume Generation in Detail

### Entering a JD

A single textarea accepts either the full JD text or a JD page URL — the system auto-detects whether the input starts with `http(s)://`, and if so, has the AI fetch the page content itself via the WebFetch tool.

### What happens during generation (auto-convergence)

Clicking "生成简历" (Generate Resume) doesn't just ask the AI once and stop — every generation or chat turn goes through an **auto-convergence loop**:

- Once a result comes back, the system compiles the Typst source for real on the server and checks the page count and "fill ratio" (how much of the page height the content actually occupies).
- If it doesn't meet "exactly one page, fill ratio at least 90%," the system **automatically** sends up to 3 more corrective chat turns (a "shorten to one page" instruction if it's overflowing, a "fill it in" instruction if it's underfull), each including a target character count computed from that round's own actual character-count/fill-ratio numbers.
- Every round shows up in the chat log as an assistant message prefixed "自动调整：" (Auto-adjustment:) so you can see the intermediate steps.
- The final result used isn't necessarily the last round — the system scores every round and picks whichever is "closest to converged" (since a correction can overshoot, e.g. compressing to one page but leaving too much empty space).

In other words, **one click of "Generate" can silently run up to 4 total AI turns behind the scenes** — this is why generation can sometimes take longer than expected.

### After generation: refining via chat

Once generation completes, the left chat panel can be used to keep refining, e.g.:

> "Make the bullet about database optimization more quantified"
> "Make the overall tone a bit more formal"
> "Emphasize my concurrent-systems experience more"

**Note**: the Generate Resume page's chat has **no** @-targeting feature (unlike the Experience Distillation page, which can @mention a specific highlight) — to refine one specific bullet, you have to describe which one you mean in plain language (e.g. mentioning the company name or a keyword), and the AI uses its own judgment to figure out which part of the resume you're referring to. Every reply re-emits the **entire** Typst source (never a partial diff).

### Warning banners and one-click fixes

- **Over one page**: a banner reads "当前 N 页，超出一页限制" (Currently N pages, over the one-page limit), with a **"自动压缩到一页" (Auto-compress to One Page)** button that has the AI shorten it automatically.
- **Noticeably underfull**: when the page is single but clearly not full (below roughly 85%), a banner reads "页面下方还有较多空白" (There's noticeable empty space at the bottom), with a **"自动填充更多内容" (Auto-fill More Content)** button that has the AI fill it in per a fixed tiered strategy (layout adjustments first, then deepen an existing experience with an unused highlight, and only as a last resort add a new, secondarily-relevant entry).

### Manually editing the Typst source

Once you've generated at least once, a **"编辑 Typst 源码" (Edit Typst Source)** button appears next to the template selector. Clicking it "flips" the entire left pane — the JD textarea and chat — into a syntax-highlighted Typst code editor bound directly to the current resume source; edits sync live to the preview on the right (no manual "recompile" needed). This suits the "the AI got it almost right, I just want to tweak a few words myself" case. Click **"返回对话" (Back to Chat)** to switch back at any time (your manual edits aren't lost).

### Save vs. Download

- **"下载 PDF" (Download PDF)**: compiles the current content to a PDF in the browser and downloads it — it is **not** saved into resume history.
- **"保存" (Save)**: creates a new entry in "Resume History" (including the JD, detected company/role, chat history, and Typst source), and compiles + uploads the corresponding PDF file. **Only saved resumes appear in the Resume History list.**

## Resume History in Detail

- Card fields: title (prefers "company-role," falling back to whichever label is available), created-at timestamp, a truncated JD excerpt.
- **Download**: downloads the saved PDF file directly.
- **Delete**: removes both the database record and the PDF file on disk (with a confirmation prompt).
- **Preview**: opens a large preview of the compiled Typst result.
- **Edit and save** (new feature): click **"编辑" (Edit)** in the top-right of the preview modal to expand a Typst source editor (using the same highlighting setup as the Generate Resume page's editor) to the left of the preview — edits sync live to the preview next to it. Click **"保存" (Save)** to write the new source back into this history entry and recompile/replace the corresponding PDF file. Clicking "取消编辑" (Cancel Editing) or closing the modal while there are unsaved edits prompts a confirmation first.

This means a small typo/fix discovered after the fact doesn't require going back through the whole Generate Resume flow — you can just fix it directly in the history entry.

## Floating Assistant (the round "AI" button on the right edge)

This is a small assistant **entirely separate** from the features above — it's specifically for adjusting this tool's own "behavioral configuration," i.e. `.claude/CLAUDE.md` (project memory) and the skill documents under `.claude/skills/`. Things like "make highlight extraction push harder for quantified numbers" or "change the bolding rules used when generating a resume" can be said directly to this assistant, and it will go edit the corresponding documents for you.

- **It cannot see or edit this tool's own source code, or your resume data** — it can only read/write files under `.claude/`.
- The header's **"+ 新对话" (+ New Conversation)** button starts a genuinely fresh conversation (it actually ends the old session, not just clearing the display).
- Supports `@` mentioning a specific skill (e.g. `@skills/resume-generation`) or `@memory` (i.e. `CLAUDE.md`), to scope its edits to exactly that target.
- The chat history is stored in the browser locally (not the database), so clearing your browser data loses this chat history (but doesn't affect your resume/experience data).

## Known Limitations

- There's no UI to set a "default template" (`isDefault`), even though the database and API already support this field.
- The Generate Resume page's chat doesn't support @-targeting a specific part of the resume to edit — only free-text description; the Experience Distillation page does support this.
- There's no in-app UI for configuring Claude access (API key / login) — it must be configured at the system level beforehand.
- This is a single-user, local-only tool with no account system and no multi-user isolation.
