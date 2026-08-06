"use client";

import { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { TypstPreview } from "@/components/TypstPreview";
import { typstLanguage } from "@/lib/typstLanguage";
import { useIsDarkMode } from "@/lib/useIsDarkMode";
import { compileTypstPdf } from "@/lib/typstClient";
import { toast } from "@/lib/toast";
import { ApiError, apiGet, apiDelete, apiPut, apiPutBinary } from "@/lib/apiClient";
import { UNSAVED_CHANGES_MESSAGE } from "@/lib/unsavedChanges";

type GeneratedResume = {
  id: string;
  label: string;
  jdSource: string;
  jdIsUrl: boolean;
  company: string;
  targetRoleTag: string;
  typstSource: string;
  pdfPath: string | null;
  createdAt: string;
};

// Widens the preview modal beyond the resume's true paper aspect ratio, so
// it doesn't feel like a narrow portrait strip on wide screens — TypstPreview
// centers the page within the extra space (see `centered` prop below).
const PREVIEW_WIDTH_BOOST = 1.4;
// Extra width added to the modal when the Typst source editor is expanded
// to the left of the preview.
const EDITOR_WIDTH = 420;

function titleFor(r: GeneratedResume) {
  if (r.company && r.targetRoleTag) return `${r.company}-${r.targetRoleTag}`;
  if (r.company || r.targetRoleTag) return r.company || r.targetRoleTag;
  return r.label;
}

export default function ResumesPage() {
  const [resumes, setResumes] = useState<GeneratedResume[]>([]);
  const [previewResume, setPreviewResume] = useState<GeneratedResume | null>(null);
  const [previewAspect, setPreviewAspect] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [editedSource, setEditedSource] = useState("");
  const [savedEditSnapshot, setSavedEditSnapshot] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const isDark = useIsDarkMode();

  const isEditDirty = editing && editedSource !== savedEditSnapshot;

  async function refresh() {
    setResumes(await apiGet<GeneratedResume[]>("/api/resumes"));
  }

  useEffect(() => {
    refresh();
  }, []);

  function closePreview() {
    if (isEditDirty && !confirm(UNSAVED_CHANGES_MESSAGE)) return;
    setPreviewResume(null);
    setEditing(false);
  }

  useEffect(() => {
    if (!previewResume) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closePreview();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewResume, isEditDirty]);

  async function remove(id: string) {
    if (!confirm("删除这份简历？")) return;
    await apiDelete(`/api/resumes/${id}`);
    await refresh();
  }

  function openPreview(r: GeneratedResume) {
    setPreviewAspect(null);
    setPreviewResume(r);
    setEditing(false);
    setEditedSource(r.typstSource);
    setSavedEditSnapshot(r.typstSource);
  }

  function toggleEditing() {
    if (editing) {
      if (isEditDirty && !confirm(UNSAVED_CHANGES_MESSAGE)) return;
      setEditing(false);
      return;
    }
    setEditedSource(previewResume?.typstSource ?? "");
    setSavedEditSnapshot(previewResume?.typstSource ?? "");
    setEditing(true);
  }

  async function saveEdit() {
    if (!previewResume) return;
    setSavingEdit(true);
    try {
      const updated = await apiPut<GeneratedResume>(`/api/resumes/${previewResume.id}`, {
        typstSource: editedSource,
      });
      const pdfBytes = await compileTypstPdf(editedSource);
      await apiPutBinary(`/api/resumes/${previewResume.id}/pdf`, pdfBytes as BodyInit, "application/pdf");
      setPreviewResume(updated);
      setResumes((list) => list.map((r) => (r.id === updated.id ? updated : r)));
      setSavedEditSnapshot(editedSource);
      toast("已保存");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "保存失败，请重试");
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div className="mx-auto h-full max-w-5xl overflow-y-auto p-6">
      <h1 className="mb-4 text-xl font-semibold">历史简历</h1>
      {resumes.length === 0 && <p className="text-sm text-neutral-500">还没有生成过简历。</p>}
      <div className="grid grid-cols-2 gap-4">
        {resumes.map((r) => (
          <div key={r.id} className="card flex flex-col gap-2">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{titleFor(r)}</div>
                <div className="text-xs text-neutral-500">{new Date(r.createdAt).toLocaleString()}</div>
              </div>
              <div className="flex gap-2">
                <a
                  className="btn-secondary"
                  href={`/api/resumes/${r.id}/pdf`}
                  download="resume.pdf"
                  aria-disabled={!r.pdfPath}
                >
                  下载
                </a>
                <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => remove(r.id)}>
                  删除
                </button>
              </div>
            </div>
            <div className="truncate text-xs text-neutral-500">
              {r.jdIsUrl ? r.jdSource : r.jdSource.slice(0, 80)}
            </div>
            <button type="button" className="btn-secondary self-start" onClick={() => openPreview(r)}>
              预览
            </button>
          </div>
        ))}
      </div>

      {previewResume && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={closePreview}>
          <div
            className="relative h-dvh bg-white dark:bg-neutral-900"
            style={
              previewAspect
                ? { width: `calc(100dvh * ${previewAspect * PREVIEW_WIDTH_BOOST} + ${editing ? EDITOR_WIDTH : 0}px)` }
                : { width: editing ? "85vw" : "60vw" }
            }
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute right-2 top-2 z-10 flex gap-2">
              {editing && (
                <button
                  type="button"
                  className="rounded-full bg-black/60 px-3 py-1 text-sm text-white hover:bg-black/80 disabled:opacity-50"
                  onClick={saveEdit}
                  disabled={savingEdit || !isEditDirty}
                >
                  {savingEdit ? "保存中…" : "保存"}
                </button>
              )}
              <button
                type="button"
                className="rounded-full bg-black/60 px-3 py-1 text-sm text-white hover:bg-black/80"
                onClick={toggleEditing}
              >
                {editing ? "取消编辑" : "编辑"}
              </button>
              <button
                type="button"
                className="rounded-full bg-black/60 px-3 py-1 text-sm text-white hover:bg-black/80"
                onClick={closePreview}
              >
                关闭
              </button>
            </div>
            <div className="flex h-full">
              {editing && (
                <div
                  className="shrink-0 overflow-hidden border-r border-neutral-200 dark:border-neutral-800"
                  style={{ width: EDITOR_WIDTH }}
                >
                  <CodeMirror
                    value={editedSource}
                    height="100%"
                    theme={isDark ? "dark" : "light"}
                    extensions={[typstLanguage]}
                    onChange={(value) => setEditedSource(value)}
                    style={{ height: "100%", fontSize: 13 }}
                  />
                </div>
              )}
              <TypstPreview
                source={editing ? editedSource : previewResume.typstSource}
                className="h-full min-w-0 flex-1"
                centered
                onCompiled={(info) => {
                  if (info.width && info.height) setPreviewAspect(info.width / info.height);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
