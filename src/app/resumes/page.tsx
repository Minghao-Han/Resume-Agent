"use client";

import { useEffect, useState } from "react";
import { TypstPreview } from "@/components/TypstPreview";
import { apiGet, apiDelete } from "@/lib/apiClient";

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

function titleFor(r: GeneratedResume) {
  if (r.company && r.targetRoleTag) return `${r.company}-${r.targetRoleTag}`;
  if (r.company || r.targetRoleTag) return r.company || r.targetRoleTag;
  return r.label;
}

export default function ResumesPage() {
  const [resumes, setResumes] = useState<GeneratedResume[]>([]);
  const [previewResume, setPreviewResume] = useState<GeneratedResume | null>(null);
  const [previewAspect, setPreviewAspect] = useState<number | null>(null);

  async function refresh() {
    setResumes(await apiGet<GeneratedResume[]>("/api/resumes"));
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!previewResume) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setPreviewResume(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewResume]);

  async function remove(id: string) {
    if (!confirm("删除这份简历？")) return;
    await apiDelete(`/api/resumes/${id}`);
    await refresh();
  }

  function openPreview(r: GeneratedResume) {
    setPreviewAspect(null);
    setPreviewResume(r);
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
                  download={`${r.label}.pdf`}
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setPreviewResume(null)}
        >
          <div
            className="relative h-dvh bg-white dark:bg-neutral-900"
            style={previewAspect ? { width: `calc(100dvh * ${previewAspect})` } : { width: "60vw" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-2 top-2 z-10 rounded-full bg-black/60 px-3 py-1 text-sm text-white hover:bg-black/80"
              onClick={() => setPreviewResume(null)}
            >
              关闭
            </button>
            <TypstPreview
              source={previewResume.typstSource}
              className="h-full"
              onCompiled={(info) => {
                if (info.width && info.height) setPreviewAspect(info.width / info.height);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
