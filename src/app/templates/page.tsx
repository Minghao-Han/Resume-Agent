"use client";

import { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { TypstPreview, type TypstCompileInfo } from "@/components/TypstPreview";
import { DEFAULT_TYPST_TEMPLATE } from "@/lib/defaultTemplate";
import { useIsDarkMode } from "@/lib/useIsDarkMode";
import { toast } from "@/lib/toast";
import { typstLanguage } from "@/lib/typstLanguage";
import { ApiError, apiGet, apiPost, apiPut, apiDelete } from "@/lib/apiClient";
import { useReportDirty, UNSAVED_CHANGES_MESSAGE } from "@/lib/unsavedChanges";

type TemplateSummary = { id: string; name: string; isDefault: boolean; updatedAt: string };
type TemplateCalibration = {
  charRangeLow: number | null;
  charRangeHigh: number | null;
  realPageHeightPt: number;
  calibratedAt: string;
};
type Template = TemplateSummary & { typstSource: string; calibration: string | null };

function describeCharRange(calibration: TemplateCalibration | null): string {
  if (!calibration) return "尚未分析";
  const { charRangeLow: low, charRangeHigh: high } = calibration;
  if (low !== null && high !== null) return `${low} – ${high} 字符`;
  if (low !== null) return `> ${low} 字符（还未探到上限）`;
  if (high !== null) return `< ${high} 字符（还未探到下限）`;
  return "分析未收敛到有效区间";
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("新模板");
  const [source, setSource] = useState(DEFAULT_TYPST_TEMPLATE);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [calibration, setCalibration] = useState<TemplateCalibration | null>(null);
  const [compileInfo, setCompileInfo] = useState<TypstCompileInfo>({ pageCount: 0, error: null });
  const [savedSnapshot, setSavedSnapshot] = useState({ name: "新模板", source: DEFAULT_TYPST_TEMPLATE });
  const isDark = useIsDarkMode();

  const isDirty = name !== savedSnapshot.name || source !== savedSnapshot.source;
  useReportDirty(isDirty);

  async function refreshList() {
    const data = await apiGet<TemplateSummary[]>("/api/templates");
    setTemplates(data);
    return data;
  }

  useEffect(() => {
    refreshList().then((list) => {
      const first = list.find((t) => t.isDefault) ?? list[0];
      if (first) loadTemplate(first.id);
    });
  }, []);

  function confirmDiscardIfDirty() {
    return !isDirty || confirm(UNSAVED_CHANGES_MESSAGE);
  }

  async function loadTemplate(id: string) {
    const data = await apiGet<Template>(`/api/templates/${id}`);
    setSelectedId(data.id);
    setName(data.name);
    setSource(data.typstSource);
    setSavedSnapshot({ name: data.name, source: data.typstSource });
    setCalibration(data.calibration ? JSON.parse(data.calibration) : null);
  }

  function startNew() {
    setSelectedId(null);
    setName("新模板");
    setSource(DEFAULT_TYPST_TEMPLATE);
    setSavedSnapshot({ name: "新模板", source: DEFAULT_TYPST_TEMPLATE });
    setCalibration(null);
  }

  async function save() {
    setSaving(true);
    try {
      if (selectedId) {
        const updated = await apiPut<Template>(`/api/templates/${selectedId}`, { name, typstSource: source });
        setCalibration(updated.calibration ? JSON.parse(updated.calibration) : null);
      } else {
        const created = await apiPost<Template>("/api/templates", { name, typstSource: source });
        setSelectedId(created.id);
        setCalibration(null);
      }
      setSavedSnapshot({ name, source });
      await refreshList();
      toast("已保存");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  async function analyze() {
    if (!selectedId) return;
    if (isDirty && !confirm(`${UNSAVED_CHANGES_MESSAGE}\n\n分析基于已保存的版本，请先保存。`)) return;
    setAnalyzing(true);
    try {
      const result = await apiPost<TemplateCalibration>(`/api/templates/${selectedId}/analyze`, {});
      setCalibration(result);
      toast("分析完成");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "分析失败，请重试");
    } finally {
      setAnalyzing(false);
    }
  }

  async function remove() {
    if (!selectedId) return;
    if (!confirm(`删除模板「${name}」？`)) return;
    await apiDelete(`/api/templates/${selectedId}`);
    setSavedSnapshot({ name: "新模板", source: DEFAULT_TYPST_TEMPLATE });
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
          onChange={(e) => {
            if (!confirmDiscardIfDirty()) return;
            if (e.target.value) loadTemplate(e.target.value);
            else startNew();
          }}
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
        <button
          type="button"
          className="btn-secondary"
          onClick={() => confirmDiscardIfDirty() && startNew()}
        >
          新建
        </button>
        <button type="button" className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "保存中…" : "保存为模板"}
        </button>
        {selectedId && (
          <button type="button" className="btn-secondary" onClick={analyze} disabled={analyzing}>
            {analyzing ? "分析中…（可能需要一两分钟）" : "分析模板"}
          </button>
        )}
        {selectedId && (
          <button type="button" className="btn-secondary text-red-600" onClick={remove}>
            删除
          </button>
        )}
        <span className="ml-auto text-sm text-neutral-500">
          {compileInfo.error ? "编译出错" : `${compileInfo.pageCount} 页`}
        </span>
      </div>

      {selectedId && (
        <p className="mb-3 text-xs text-neutral-500">
          单页容量估计：{describeCharRange(calibration)}
          {calibration && `（用于生成简历时提示大概该写多少内容，不是硬性规则）`}
        </p>
      )}

      {templates.length === 0 && (
        <p className="mb-3 text-sm text-neutral-500">
          还没有保存过任何模板——下面是一个空白起点，编辑好之后点击「保存为模板」创建第一个。
        </p>
      )}

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
