"use client";

import { useEffect, useState } from "react";
import { TypstPreview } from "@/components/TypstPreview";

type GeneratedResume = {
  id: string;
  label: string;
  jdSource: string;
  jdIsUrl: boolean;
  targetRoleTag: string;
  typstSource: string;
  pdfPath: string | null;
  createdAt: string;
};

export default function ResumesPage() {
  const [resumes, setResumes] = useState<GeneratedResume[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/resumes");
    setResumes(await res.json());
  }

  useEffect(() => {
    refresh();
  }, []);

  async function remove(id: string) {
    if (!confirm("删除这份简历？")) return;
    await fetch(`/api/resumes/${id}`, { method: "DELETE" });
    await refresh();
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-xl font-semibold">历史简历</h1>
      {resumes.length === 0 && <p className="text-sm text-neutral-500">还没有生成过简历。</p>}
      <div className="grid grid-cols-2 gap-4">
        {resumes.map((r) => (
          <div key={r.id} className="card flex flex-col gap-2">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{r.label}</div>
                <div className="text-xs text-neutral-500">
                  {new Date(r.createdAt).toLocaleString()}
                  {r.targetRoleTag && ` · ${r.targetRoleTag}`}
                </div>
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
            <button
              type="button"
              className="btn-secondary self-start"
              onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
            >
              {expandedId === r.id ? "收起预览" : "预览"}
            </button>
            {expandedId === r.id && <TypstPreview source={r.typstSource} className="h-[36rem]" />}
          </div>
        ))}
      </div>
    </div>
  );
}
