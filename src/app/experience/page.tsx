"use client";

import { useEffect, useState } from "react";
import { ChatPanel, type ChatMessage } from "@/components/ChatPanel";

type ExperienceType = "intern" | "project";

type ExperienceSummary = {
  id: string;
  title: string;
  org: string;
  type: ExperienceType;
  tags: string[];
  updatedAt: string;
};

type Experience = ExperienceSummary & {
  rawInput: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  quantify: string;
  chatHistory: ChatMessage[];
  sessionId?: string | null;
};

type StarQ = {
  situation: string;
  task: string;
  action: string;
  result: string;
  quantify: string;
  tags: string[];
};

const EMPTY: Experience = {
  id: "",
  title: "",
  org: "",
  type: "intern",
  rawInput: "",
  situation: "",
  task: "",
  action: "",
  result: "",
  quantify: "",
  tags: [],
  chatHistory: [],
  sessionId: null,
  updatedAt: "",
};

export default function ExperiencePage() {
  const [list, setList] = useState<ExperienceSummary[]>([]);
  const [current, setCurrent] = useState<Experience>(EMPTY);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState("");

  async function refreshList() {
    const res = await fetch("/api/experiences");
    setList(await res.json());
  }

  useEffect(() => {
    refreshList();
  }, []);

  function startNew() {
    setCurrent(EMPTY);
  }

  async function loadExperience(id: string) {
    const res = await fetch(`/api/experiences/${id}`);
    setCurrent(await res.json());
  }

  function applyStarQ(starQ: StarQ) {
    setCurrent((c) => ({ ...c, ...starQ }));
  }

  async function extract() {
    if (!current.rawInput.trim()) return;
    setSending(true);
    const message = `Type: ${current.type}\nTitle: ${current.title}\nOrganization: ${current.org}\n\nRaw description:\n${current.rawInput}`;
    try {
      const res = await fetch("/api/experience/distill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId: current.sessionId ?? undefined }),
      });
      const data: { sessionId?: string; reply: string; starQ: StarQ | null } = await res.json();
      setCurrent((c) => ({
        ...c,
        sessionId: data.sessionId ?? c.sessionId,
        chatHistory: [
          ...c.chatHistory,
          { role: "user", content: message },
          { role: "assistant", content: data.reply },
        ],
      }));
      if (data.starQ) applyStarQ(data.starQ);
    } finally {
      setSending(false);
    }
  }

  async function sendChat(text: string) {
    setCurrent((c) => ({ ...c, chatHistory: [...c.chatHistory, { role: "user", content: text }] }));
    setSending(true);
    try {
      const res = await fetch("/api/experience/distill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId: current.sessionId ?? undefined }),
      });
      const data: { sessionId?: string; reply: string; starQ: StarQ | null } = await res.json();
      setCurrent((c) => ({
        ...c,
        sessionId: data.sessionId ?? c.sessionId,
        chatHistory: [...c.chatHistory, { role: "assistant", content: data.reply }],
      }));
      if (data.starQ) applyStarQ(data.starQ);
    } finally {
      setSending(false);
    }
  }

  function addTag() {
    const t = tagInput.trim();
    if (!t) return;
    setCurrent((c) => (c.tags.includes(t) ? c : { ...c, tags: [...c.tags, t] }));
    setTagInput("");
  }

  function removeTag(tag: string) {
    setCurrent((c) => ({ ...c, tags: c.tags.filter((t) => t !== tag) }));
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        title: current.title,
        org: current.org,
        type: current.type,
        rawInput: current.rawInput,
        situation: current.situation,
        task: current.task,
        action: current.action,
        result: current.result,
        quantify: current.quantify,
        tags: current.tags,
        chatHistory: current.chatHistory,
        sessionId: current.sessionId ?? undefined,
      };
      const res = current.id
        ? await fetch(`/api/experiences/${current.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/experiences", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const saved: Experience = await res.json();
      setCurrent(saved);
      await refreshList();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-56 shrink-0 overflow-y-auto border-r border-neutral-200 p-3 dark:border-neutral-800">
        <button type="button" className="btn-secondary mb-3 w-full" onClick={startNew}>
          + 新建经历
        </button>
        <div className="flex flex-col gap-1">
          {list.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => loadExperience(e.id)}
              className={`rounded px-2 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10 ${
                current.id === e.id ? "bg-black/5 dark:bg-white/10" : ""
              }`}
            >
              <div className="truncate font-medium">{e.title || "(未命名)"}</div>
              <div className="truncate text-xs text-neutral-500">{e.org}</div>
            </button>
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
            placeholder="粘贴完整经历描述…"
            value={current.rawInput}
            onChange={(e) => setCurrent((c) => ({ ...c, rawInput: e.target.value }))}
          />
          <button type="button" className="btn-primary mt-2" onClick={extract} disabled={sending}>
            {sending ? "提取中…" : "提取 STAR-Q"}
          </button>

          <div className="mt-4 flex flex-col gap-2">
            <StarQField label="Situation" value={current.situation} onChange={(v) => setCurrent((c) => ({ ...c, situation: v }))} />
            <StarQField label="Task" value={current.task} onChange={(v) => setCurrent((c) => ({ ...c, task: v }))} />
            <StarQField label="Action" value={current.action} onChange={(v) => setCurrent((c) => ({ ...c, action: v }))} />
            <StarQField label="Result" value={current.result} onChange={(v) => setCurrent((c) => ({ ...c, result: v }))} />
            <StarQField label="Quantify" value={current.quantify} onChange={(v) => setCurrent((c) => ({ ...c, quantify: v }))} />
          </div>

          <div className="mt-4">
            <div className="mb-1 text-sm text-neutral-600 dark:text-neutral-400">适用角色标签</div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {current.tags.map((tag) => (
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
        />
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
