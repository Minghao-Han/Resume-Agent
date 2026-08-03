"use client";

import { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { TypstPreview, type TypstCompileInfo } from "@/components/TypstPreview";
import { DEFAULT_TYPST_TEMPLATE } from "@/lib/defaultTemplate";
import { useIsDarkMode } from "@/lib/useIsDarkMode";
import { toast } from "@/lib/toast";
import { typstLanguage } from "@/lib/typstLanguage";

type TemplateSummary = { id: string; name: string; isDefault: boolean; updatedAt: string };
type Template = TemplateSummary & { typstSource: string };

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("新模板");
  const [source, setSource] = useState(DEFAULT_TYPST_TEMPLATE);
  const [saving, setSaving] = useState(false);
  const [compileInfo, setCompileInfo] = useState<TypstCompileInfo>({ pageCount: 0, error: null });
  const isDark = useIsDarkMode();

  async function refreshList() {
    const res = await fetch("/api/templates");
    const data: TemplateSummary[] = await res.json();
    setTemplates(data);
    return data;
  }

  useEffect(() => {
    refreshList().then((list) => {
      const first = list.find((t) => t.isDefault) ?? list[0];
      if (first) loadTemplate(first.id);
    });
  }, []);

  async function loadTemplate(id: string) {
    const res = await fetch(`/api/templates/${id}`);
    const data: Template = await res.json();
    setSelectedId(data.id);
    setName(data.name);
    setSource(data.typstSource);
  }

  function startNew() {
    setSelectedId(null);
    setName("新模板");
    setSource(DEFAULT_TYPST_TEMPLATE);
  }

  async function save() {
    setSaving(true);
    try {
      if (selectedId) {
        await fetch(`/api/templates/${selectedId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, typstSource: source }),
        });
      } else {
        const res = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, typstSource: source }),
        });
        const created: Template = await res.json();
        setSelectedId(created.id);
      }
      await refreshList();
      toast("已保存");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!selectedId) return;
    if (!confirm(`删除模板「${name}」？`)) return;
    await fetch(`/api/templates/${selectedId}`, { method: "DELETE" });
    startNew();
    await refreshList();
    toast("已删除");
  }

  return (
    <div className="flex h-full min-h-0 flex-col p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          className="input"
          value={selectedId ?? ""}
          onChange={(e) => (e.target.value ? loadTemplate(e.target.value) : startNew())}
        >
          <option value="">(新建模板)</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.isDefault ? " · 默认" : ""}
            </option>
          ))}
        </select>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="button" className="btn-secondary" onClick={startNew}>
          新建
        </button>
        <button type="button" className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "保存中…" : "保存为模板"}
        </button>
        {selectedId && (
          <button type="button" className="btn-secondary text-red-600" onClick={remove}>
            删除
          </button>
        )}
        <span className="ml-auto text-sm text-neutral-500">
          {compileInfo.error ? "编译出错" : `${compileInfo.pageCount} 页`}
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-4">
        <div className="min-h-0 overflow-hidden rounded border border-neutral-200 dark:border-neutral-800">
          <CodeMirror
            value={source}
            height="100%"
            theme={isDark ? "dark" : "light"}
            extensions={[typstLanguage]}
            onChange={(value) => setSource(value)}
            style={{ height: "100%", fontSize: 13 }}
          />
        </div>
        <TypstPreview source={source} className="min-h-0" onCompiled={setCompileInfo} />
      </div>
    </div>
  );
}
