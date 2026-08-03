"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/experience", label: "经历蒸馏" },
  { href: "/generate", label: "生成简历" },
  { href: "/resumes", label: "历史简历" },
  { href: "/templates", label: "模板编辑" },
  { href: "/profile", label: "个人信息" },
];

export function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
      <span className="mr-4 text-sm font-semibold">Resume Tailor</span>
      {LINKS.map((link) => {
        const active = pathname?.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded px-3 py-1.5 text-sm ${
              active
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "hover:bg-black/5 dark:hover:bg-white/10"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
