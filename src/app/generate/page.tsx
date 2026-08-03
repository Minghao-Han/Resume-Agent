"use client";

import { useEffect, useState } from "react";
import { ChatPanel, type ChatMessage } from "@/components/ChatPanel";
import { TypstPreview, type TypstCompileInfo } from "@/components/TypstPreview";
import { compileTypstPdf, downloadPdfBytes } from "@/lib/typstClient";
import { toast } from "@/lib/toast";
import { ApiError, apiGet, apiPost, apiPutBinary } from "@/lib/apiClient";
import { useReportDirty, UNSAVED_CHANGES_MESSAGE } from "@/lib/unsavedChanges";

type TemplateSummary = { id: string; name: string; isDefault: boolean };

function looksLikeUrl(text: string) {
  return /^https?:\/\//i.test(text.trim());
}

export default function GeneratePage() {
  const [jdText, setJdText] = useState("");
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [typstSource, setTypstSource] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [generating, setGenerating] = useState(false);
  const [compileInfo, setCompileInfo] = useState<TypstCompileInfo>({ pageCount: 0, error: null });
  const [label, setLabel] = useState("");
  const [company, setCompany] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedTypstSnapshot, setSavedTypstSnapshot] = useState("");

  const isDirty = typstSource !== "" && typstSource !== savedTypstSnapshot;
  useReportDirty(isDirty);

  useEffect(() => {
    apiGet<TemplateSummary[]>("/api/templates").then((list) => {
      setTemplates(list);
      const def = list.find((t) => t.isDefault) ?? list[0];
      if (def) setTemplateId(def.id);
    });
  }, []);

  async function generate() {
    if (!jdText.trim() || !templateId) return;
    if (isDirty && !confirm(UNSAVED_CHANGES_MESSAGE)) return;
    setGenerating(true);
    try {
      const data = await apiPost<{
        sessionId?: string;
        reply: string;
        typstSource: string | null;
        company?: string;
        role?: string;
        isError?: boolean;
      }>("/api/resume/generate", { jdText, jdIsUrl: looksLikeUrl(jdText), templateId });
      if (data.isError) toast(data.reply);
      setSessionId(data.sessionId);
      setMessages([
        { role: "user", content: looksLikeUrl(jdText) ? `JD URL: ${jdText}` : `JD:\n${jdText}` },
        { role: "assistant", content: data.reply },
      ]);
      if (data.typstSource) setTypstSource(data.typstSource);
      if (data.company) setCompany(data.company);
      if (data.role) setTargetRole(data.role);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "生成失败，请重试");
    } finally {
      setGenerating(false);
    }
  }

  async function sendChat(text: string) {
    if (!sessionId) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setGenerating(true);
    try {
      const data = await apiPost<{
        sessionId?: string;
        reply: string;
        typstSource: string | null;
        company?: string;
        role?: string;
        isError?: boolean;
      }>("/api/resume/generate", { sessionId, message: text });
      if (data.isError) toast(data.reply);
      setSessionId(data.sessionId ?? sessionId);
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      if (data.typstSource) setTypstSource(data.typstSource);
      if (data.company) setCompany(data.company);
      if (data.role) setTargetRole(data.role);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "出错了，请重试";
      toast(message);
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${message}` }]);
    } finally {
      setGenerating(false);
    }
  }

  function shortenToOnePage() {
    sendChat(
      `The compiled resume is currently ${compileInfo.pageCount} pages. Please shorten it to fit exactly one page.`
    );
  }

  async function save() {
    if (!typstSource) return;
    setSaving(true);
    try {
      const created = await apiPost<{ id: string }>("/api/resumes", {
        label: label || `简历 ${new Date().toLocaleString()}`,
        jdSource: jdText,
        jdIsUrl: looksLikeUrl(jdText),
        company,
        targetRoleTag: targetRole,
        typstSource,
        chatHistory: messages,
      });
      const pdfBytes = await compileTypstPdf(typstSource);
      await apiPutBinary(`/api/resumes/${created.id}/pdf`, pdfBytes as BodyInit, "application/pdf");
      setSavedTypstSnapshot(typstSource);
      toast("已保存");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  async function download() {
    const pdfBytes = await compileTypstPdf(typstSource);
    downloadPdfBytes(pdfBytes, `${label || "resume"}.pdf`);
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-2">
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto border-r border-neutral-200 p-4 dark:border-neutral-800">
        <label className="flex items-center gap-2 text-sm">
          <span className="shrink-0 text-neutral-600 dark:text-neutral-400">使用模板</span>
          <select
            className="input flex-1"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            disabled={templates.length === 0}
          >
            {templates.length === 0 && <option value="">（还没有模板）</option>}
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.isDefault ? " · 默认" : ""}
              </option>
            ))}
          </select>
        </label>
        {templates.length === 0 && (
          <p className="text-sm text-neutral-500">
            还没有可用的简历模板，先去「模板编辑」页创建一个吧。
          </p>
        )}
        <textarea
          className="textarea w-full"
          rows={6}
          placeholder="粘贴 JD 文本，或直接粘贴 JD 链接（以 http(s):// 开头会自动识别为 URL）…"
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
        />
        <button
          type="button"
          className="btn-primary"
          onClick={generate}
          disabled={generating || !jdText.trim() || !templateId}
        >
          {generating ? "生成中…" : sessionId ? "重新生成" : "生成简历"}
        </button>

        <ChatPanel
          className="min-h-0 flex-1 rounded border border-neutral-200 dark:border-neutral-800"
          messages={messages}
          onSend={sendChat}
          sending={generating}
          placeholder={sessionId ? "继续对话调整简历…" : "先生成一次简历，之后可以继续对话调整"}
        />
      </div>

      <div className="flex min-h-0 flex-col gap-2 p-4">
        {(company || targetRole) && (
          <div className="text-xs text-neutral-500">
            识别到目标：{company || "（未知公司）"} · {targetRole || "（未知岗位）"}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            className="input flex-1"
            placeholder="简历名称（保存用）"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <button type="button" className="btn-secondary" onClick={download} disabled={!typstSource}>
            下载 PDF
          </button>
          <button type="button" className="btn-primary" onClick={save} disabled={!typstSource || saving}>
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
        {compileInfo.pageCount > 1 && (
          <div className="flex items-center justify-between rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            <span>当前 {compileInfo.pageCount} 页，超出一页限制</span>
            <button type="button" className="btn-secondary" onClick={shortenToOnePage} disabled={generating}>
              自动压缩到一页
            </button>
          </div>
        )}
        <TypstPreview source={typstSource} className="min-h-0 flex-1" onCompiled={setCompileInfo} />
      </div>
    </div>
  );
}
