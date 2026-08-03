"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "@/lib/toast";
import { ApiError, apiGet, apiPut } from "@/lib/apiClient";

type Education = {
  id?: string;
  school: string;
  degree: string;
  major: string;
  startDate: string;
  endDate: string;
  region: string;
  relevantCourses: string;
  gpa: string;
};

type Profile = {
  name: string;
  phone: string;
  email: string;
  location: string;
  github: string;
  linkedin: string;
  educations: Education[];
};

const EMPTY_EDUCATION: Education = {
  school: "",
  degree: "",
  major: "",
  startDate: "",
  endDate: "",
  region: "",
  relevantCourses: "",
  gpa: "",
};
const EMPTY_PROFILE: Profile = {
  name: "",
  phone: "",
  email: "",
  location: "",
  github: "",
  linkedin: "",
  educations: [],
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGet<Profile>("/api/profile")
      .then((data) => setProfile(data))
      .finally(() => setLoading(false));
  }, []);

  function updateField<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  function updateEducation(index: number, patch: Partial<Education>) {
    setProfile((p) => ({
      ...p,
      educations: p.educations.map((edu, i) => (i === index ? { ...edu, ...patch } : edu)),
    }));
  }

  function addEducation() {
    setProfile((p) => ({ ...p, educations: [...p.educations, { ...EMPTY_EDUCATION }] }));
  }

  function removeEducation(index: number) {
    setProfile((p) => ({ ...p, educations: p.educations.filter((_, i) => i !== index) }));
  }

  async function save() {
    setSaving(true);
    try {
      const data = await apiPut<Profile>("/api/profile", profile);
      setProfile(data);
      toast("已保存");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-neutral-500">加载中…</div>;

  return (
    <div className="mx-auto h-full max-w-2xl overflow-y-auto p-6">
      <h1 className="mb-6 text-xl font-semibold">个人信息</h1>

      <div className="grid grid-cols-2 gap-4">
        <Field label="姓名">
          <input
            className="input"
            value={profile.name}
            onChange={(e) => updateField("name", e.target.value)}
          />
        </Field>
        <Field label="电话">
          <input
            className="input"
            value={profile.phone}
            onChange={(e) => updateField("phone", e.target.value)}
          />
        </Field>
        <Field label="邮箱">
          <input
            className="input"
            value={profile.email}
            onChange={(e) => updateField("email", e.target.value)}
          />
        </Field>
        <Field label="地区">
          <input
            className="input"
            value={profile.location}
            onChange={(e) => updateField("location", e.target.value)}
          />
        </Field>
        <Field label="GitHub">
          <input
            className="input"
            placeholder="github.com/yourname"
            value={profile.github}
            onChange={(e) => updateField("github", e.target.value)}
          />
        </Field>
        <Field label="LinkedIn">
          <input
            className="input"
            placeholder="linkedin.com/in/yourname"
            value={profile.linkedin}
            onChange={(e) => updateField("linkedin", e.target.value)}
          />
        </Field>
      </div>

      <div className="mt-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-medium">教育经历</h2>
          <button type="button" onClick={addEducation} className="btn-secondary">
            + 添加
          </button>
        </div>
        <div className="flex flex-col gap-4">
          {profile.educations.map((edu, i) => (
            <div key={edu.id ?? i} className="rounded border p-3">
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => removeEducation(i)}
                  className="text-xs text-red-600 hover:underline"
                >
                  删除
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="学校">
                  <input
                    className="input"
                    value={edu.school}
                    onChange={(e) => updateEducation(i, { school: e.target.value })}
                  />
                </Field>
                <Field label="学位">
                  <input
                    className="input"
                    value={edu.degree}
                    onChange={(e) => updateEducation(i, { degree: e.target.value })}
                  />
                </Field>
                <Field label="专业">
                  <input
                    className="input"
                    value={edu.major}
                    onChange={(e) => updateEducation(i, { major: e.target.value })}
                  />
                </Field>
                <Field label="所在地">
                  <input
                    className="input"
                    placeholder="City, State 或 City, Country"
                    value={edu.region}
                    onChange={(e) => updateEducation(i, { region: e.target.value })}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="起始">
                    <input
                      className="input"
                      placeholder="2022-09"
                      value={edu.startDate}
                      onChange={(e) => updateEducation(i, { startDate: e.target.value })}
                    />
                  </Field>
                  <Field label="结束">
                    <input
                      className="input"
                      placeholder="2026-06"
                      value={edu.endDate}
                      onChange={(e) => updateEducation(i, { endDate: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label="GPA（可选）">
                  <input
                    className="input"
                    placeholder="3.8/4.0"
                    value={edu.gpa}
                    onChange={(e) => updateEducation(i, { gpa: e.target.value })}
                  />
                </Field>
                <div className="col-span-2">
                  <Field label="相关课程">
                    <textarea
                      className="textarea"
                      rows={2}
                      placeholder="Data Structures, Machine Learning, ..."
                      value={edu.relevantCourses}
                      onChange={(e) => updateEducation(i, { relevantCourses: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            </div>
          ))}
          {profile.educations.length === 0 && (
            <p className="text-sm text-neutral-500">还没有教育经历，点击“添加”新建一条。</p>
          )}
        </div>
      </div>

      <div className="mt-8 flex items-center gap-3">
        <button type="button" onClick={save} disabled={saving} className="btn-primary">
          {saving ? "保存中…" : "保存"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-600 dark:text-neutral-400">{label}</span>
      {children}
    </label>
  );
}
