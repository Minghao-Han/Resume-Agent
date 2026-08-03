import Link from "next/link";

const CARDS = [
  { href: "/experience", title: "经历蒸馏", desc: "粘贴经历原文，Claude 提取 STAR-Q 结构并打标签" },
  { href: "/generate", title: "生成简历", desc: "粘贴 JD，从经历库挑选内容，生成一页 Typst 简历" },
  { href: "/resumes", title: "历史简历", desc: "查看、预览、下载所有已生成的简历" },
  { href: "/templates", title: "模板编辑", desc: "编辑 Typst 简历模板，实时预览" },
  { href: "/profile", title: "个人信息", desc: "维护姓名、联系方式、教育经历" },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="mb-2 text-2xl font-semibold">Resume Tailor</h1>
      <p className="mb-8 text-sm text-neutral-500">
        用 Claude 帮你把经历整理成结构化条目，再根据 JD 生成 tailored 简历。右下角可以随时打开助手调整 skill / memory。
      </p>
      <div className="grid grid-cols-2 gap-4">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href} className="card block transition hover:border-neutral-400 dark:hover:border-neutral-600">
            <div className="font-medium">{c.title}</div>
            <div className="mt-1 text-sm text-neutral-500">{c.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
