"use client";

import { useEffect, useState } from "react";
import { ChatPanel, type ChatMessage, type MentionItem } from "@/components/ChatPanel";
import { toast } from "@/lib/toast";
import { ApiError, apiGet, apiPost, apiPut, apiDelete } from "@/lib/apiClient";

type ExperienceType = "intern" | "project";

type ExperienceSummary = {
  id: string;
  title: string;
  org: string;
  type: ExperienceType;
  updatedAt: string;
};

type Highlight = {
  id?: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  quantify: string;
  resumeBullet: string;
  tags: string[];
};

type Experience = ExperienceSummary & {
  rawInput: string;
  chatHistory: ChatMessage[];
  sessionId?: string | null;
  highlights: Highlight[];
};

const EMPTY_HIGHLIGHT: Highlight = {
  title: "",
  situation: "",
  task: "",
  action: "",
  result: "",
  quantify: "",
  resumeBullet: "",
  tags: [],
};

const EMPTY: Experience = {
  id: "",
  title: "",
  org: "",
  type: "intern",
  rawInput: "",
  chatHistory: [],
  sessionId: null,
  highlights: [],
  updatedAt: "",
};

export default function ExperiencePage() {
  const [list, setList] = useState<ExperienceSummary[]>([]);
  const [current, setCurrent] = useState<Experience>(EMPTY);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);

  async function refreshList() {
    setList(await apiGet<ExperienceSummary[]>("/api/experiences"));
  }

  useEffect(() => {
    refreshList();
  }, []);

  function startNew() {
    setCurrent(EMPTY);
  }

  async function loadExperience(id: string) {
    setCurrent(await apiGet<Experience>(`/api/experiences/${id}`));
  }

  async function extract() {
    if (!current.rawInput.trim()) return;
    setSending(true);
    const message = `Type: ${current.type}\nTitle: ${current.title}\nOrganization: ${current.org}\n\nRaw description:\n${current.rawInput}`;
    try {
      const data = await apiPost<{
        sessionId?: string;
        reply: string;
        highlights: Highlight[] | null;
        isError?: boolean;
      }>("/api/experience/distill", { message, sessionId: current.sessionId ?? undefined });
      if (data.isError) toast(data.reply);
      setCurrent((c) => ({
        ...c,
        sessionId: data.sessionId ?? c.sessionId,
        highlights: data.highlights ?? c.highlights,
        chatHistory: [
          ...c.chatHistory,
          { role: "user", content: message },
          { role: "assistant", content: data.reply },
        ],
      }));
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "提取失败，请重试");
    } finally {
      setSending(false);
    }
  }

  function buildHighlightsContextMessage(text: string, mentionedIndexes: number[]): string {
    const indexed = current.highlights.map((h, i) => ({ index: i, ...h }));
    const targetNote =
      mentionedIndexes.length > 0
        ? `\n\nThe user @mentioned highlight index(es) ${mentionedIndexes.join(
            ", "
          )} in their message below (matching the "index" field above) — apply their request only to those, and leave every other highlight in the list exactly as it currently is.`
        : "";
    return [
      `Current highlights (JSON, "index" matches list order — keep any highlight not targeted below exactly unchanged, including ones not mentioned in this message):`,
      JSON.stringify(indexed, null, 2),
      targetNote,
      `\nUser message:\n${text}`,
    ].join("\n");
  }

  async function sendChat(text: string, mentionedIds: string[] = []) {
    setCurrent((c) => ({ ...c, chatHistory: [...c.chatHistory, { role: "user", content: text }] }));
    setSending(true);
    try {
      const mentionedIndexes = mentionedIds.map((id) => Number(id)).filter((n) => !Number.isNaN(n));
      const apiMessage = buildHighlightsContextMessage(text, mentionedIndexes);
      const data = await apiPost<{
        sessionId?: string;
        reply: string;
        highlights: Highlight[] | null;
        isError?: boolean;
      }>("/api/experience/distill", { message: apiMessage, sessionId: current.sessionId ?? undefined });
      if (data.isError) toast(data.reply);
      setCurrent((c) => ({
        ...c,
        sessionId: data.sessionId ?? c.sessionId,
        highlights: data.highlights ?? c.highlights,
        chatHistory: [...c.chatHistory, { role: "assistant", content: data.reply }],
      }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "出错了，请重试";
      toast(message);
      setCurrent((c) => ({ ...c, chatHistory: [...c.chatHistory, { role: "assistant", content: `⚠️ ${message}` }] }));
    } finally {
      setSending(false);
    }
  }

  function updateHighlight(index: number, patch: Partial<Highlight>) {
    setCurrent((c) => ({
      ...c,
      highlights: c.highlights.map((h, i) => (i === index ? { ...h, ...patch } : h)),
    }));
  }

  function addHighlight() {
    setCurrent((c) => ({ ...c, highlights: [...c.highlights, { ...EMPTY_HIGHLIGHT }] }));
  }

  function removeHighlight(index: number) {
    setCurrent((c) => ({ ...c, highlights: c.highlights.filter((_, i) => i !== index) }));
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        title: current.title,
        org: current.org,
        type: current.type,
        rawInput: current.rawInput,
        chatHistory: current.chatHistory,
        sessionId: current.sessionId ?? undefined,
        highlights: current.highlights,
      };
      const saved = current.id
        ? await apiPut<Experience>(`/api/experiences/${current.id}`, payload)
        : await apiPost<Experience>("/api/experiences", payload);
      setCurrent(saved);
      await refreshList();
      toast("已保存");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  async function deleteExperience(id: string) {
    const target = list.find((e) => e.id === id);
    if (!confirm(`删除经历「${target?.title || "未命名"}」？其下所有 highlight 也会被删除。`)) return;
    await apiDelete(`/api/experiences/${id}`);
    if (current.id === id) setCurrent(EMPTY);
    await refreshList();
    toast("已删除");
  }

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-56 shrink-0 overflow-y-auto border-r border-neutral-200 p-3 dark:border-neutral-800">
        <button type="button" className="btn-secondary mb-3 w-full" onClick={startNew}>
          + 新建经历
        </button>
        <div className="flex flex-col gap-1">
          {list.map((e) => (
            <div
              key={e.id}
              className={`group flex items-center rounded hover:bg-black/5 dark:hover:bg-white/10 ${
                current.id === e.id ? "bg-black/5 dark:bg-white/10" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => loadExperience(e.id)}
                className="min-w-0 flex-1 px-2 py-1.5 text-left text-sm"
              >
                <div className="truncate font-medium">{e.title || "(未命名)"}</div>
                <div className="truncate text-xs text-neutral-500">{e.org}</div>
              </button>
              <button
                type="button"
                onClick={() => deleteExperience(e.id)}
                title="删除经历"
                className="mr-1 shrink-0 rounded px-1.5 py-1 text-xs text-neutral-400 opacity-0 hover:text-red-500 group-hover:opacity-100"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </aside>

      <div className="grid min-h-0 flex-1 grid-cols-2">
        <div className="min-h-0 overflow-y-auto p-4">
          <div className="mb-3 grid grid-cols-2 gap-2">
            <input
              className="input"
              placeholder="经历标题"
              value={current.title}
              onChange={(e) => setCurrent((c) => ({ ...c, title: e.target.value }))}
            />
            <input
              className="input"
              placeholder="公司/项目名"
              value={current.org}
              onChange={(e) => setCurrent((c) => ({ ...c, org: e.target.value }))}
            />
            <select
              className="input"
              value={current.type}
              onChange={(e) => setCurrent((c) => ({ ...c, type: e.target.value as ExperienceType }))}
            >
              <option value="intern">实习</option>
              <option value="project">项目</option>
            </select>
          </div>
          <textarea
            className="textarea w-full"
            rows={6}
            placeholder="粘贴完整经历描述…（一段经历里可以包含多个独立的 highlight）"
            value={current.rawInput}
            onChange={(e) => setCurrent((c) => ({ ...c, rawInput: e.target.value }))}
          />
          <button type="button" className="btn-primary mt-2" onClick={extract} disabled={sending}>
            {sending ? "提取中…" : "提取 Highlights"}
          </button>

          <div className="mt-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
              Highlights（{current.highlights.length}）
            </h2>
            <button type="button" className="btn-secondary" onClick={addHighlight}>
              + 手动添加一条
            </button>
          </div>

          <div className="mt-2 flex flex-col gap-3">
            {current.highlights.map((h, i) => (
              <HighlightCard
                key={h.id ?? i}
                highlight={h}
                onChange={(patch) => updateHighlight(i, patch)}
                onRemove={() => removeHighlight(i)}
              />
            ))}
            {current.highlights.length === 0 && (
              <p className="text-sm text-neutral-500">还没有 highlight，先粘贴原文提取，或手动添加一条。</p>
            )}
          </div>

          <button type="button" className="btn-primary mt-6" onClick={save} disabled={saving}>
            {saving ? "保存中…" : "保存"}
          </button>
        </div>

        <ChatPanel
          className="min-h-0 border-l border-neutral-200 dark:border-neutral-800"
          messages={current.chatHistory}
          onSend={sendChat}
          sending={sending}
          placeholder="继续和 Claude 对话，调整提取结果…"
          mentionables={current.highlights.map(
            (h, i): MentionItem => ({ id: String(i), label: h.title || `Highlight ${i + 1}` })
          )}
        />
      </div>
    </div>
  );
}

function HighlightCard({
  highlight,
  onChange,
  onRemove,
}: {
  highlight: Highlight;
  onChange: (patch: Partial<Highlight>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [tagInput, setTagInput] = useState("");

  function addTag() {
    const t = tagInput.trim();
    if (!t) return;
    if (!highlight.tags.includes(t)) onChange({ tags: [...highlight.tags, t] });
    setTagInput("");
  }

  function removeTag(tag: string) {
    onChange({ tags: highlight.tags.filter((t) => t !== tag) });
  }

  return (
    <div className="card">
      <div className="mb-2 flex items-start gap-2">
        <input
          className="input flex-1 font-medium"
          placeholder="Highlight 标题"
          value={highlight.title}
          onChange={(e) => onChange({ title: e.target.value })}
        />
        <button
          type="button"
          className="btn-secondary shrink-0"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "收起" : "展开 STAR-Q"}
        </button>
        <button type="button" className="shrink-0 text-xs text-red-600 hover:underline" onClick={onRemove}>
          删除
        </button>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-neutral-600 dark:text-neutral-400">Resume Bullet</span>
        <textarea
          className="textarea"
          rows={2}
          value={highlight.resumeBullet}
          onChange={(e) => onChange({ resumeBullet: e.target.value })}
        />
      </label>

      {expanded && (
        <div className="mt-2 flex flex-col gap-2">
          <StarQField label="Situation" value={highlight.situation} onChange={(v) => onChange({ situation: v })} />
          <StarQField label="Task" value={highlight.task} onChange={(v) => onChange({ task: v })} />
          <StarQField label="Action" value={highlight.action} onChange={(v) => onChange({ action: v })} />
          <StarQField label="Result" value={highlight.result} onChange={(v) => onChange({ result: v })} />
          <StarQField label="Quantify" value={highlight.quantify} onChange={(v) => onChange({ quantify: v })} />
        </div>
      )}

      <div className="mt-2">
        <div className="mb-1 flex flex-wrap gap-1.5">
          {highlight.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
              <button type="button" className="ml-1.5 text-neutral-400 hover:text-red-500" onClick={() => removeTag(tag)}>
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="添加标签…"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
          />
          <button type="button" className="btn-secondary" onClick={addTag}>
            添加
          </button>
        </div>
      </div>
    </div>
  );
}

function StarQField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-600 dark:text-neutral-400">{label}</span>
      <textarea className="textarea" rows={2} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
