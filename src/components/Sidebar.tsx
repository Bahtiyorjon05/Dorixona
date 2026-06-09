"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: { section?: string; items: { href: string; label: string; icon: string }[] }[] = [
  {
    items: [
      { href: "/moliya", label: "Moliya", icon: "📈" },
      { href: "/harajatlar", label: "Harajatlar", icon: "🧾" },
      { href: "/ombor", label: "Ombor", icon: "📦" },
      { href: "/pos", label: "Kassa (POS)", icon: "🛒" },
    ],
  },
  {
    section: "Xodimlar",
    items: [
      { href: "/xodimlar", label: "Xodimlar", icon: "👥" },
      { href: "/kpi", label: "KPI", icon: "🎯" },
      { href: "/davomat", label: "Davomat", icon: "🕐" },
    ],
  },
  {
    section: "Hisobotlar",
    items: [{ href: "/hisobotlar", label: "Hisobotlar", icon: "📊" }],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 flex-shrink-0 flex-col gap-1 border-r border-edge bg-card py-4">
      <div className="flex items-center gap-2 px-5 pb-5 text-base font-semibold text-primary">
        <span className="text-xl">💊</span> Dorixona
      </div>

      {NAV.map((group, i) => (
        <div key={i}>
          {group.section && (
            <div className="px-5 pb-1 pt-3 text-[11px] uppercase tracking-wider text-muted">
              {group.section}
            </div>
          )}
          {group.items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mx-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-primary-light font-medium text-primary"
                    : "text-muted hover:bg-surface hover:text-[color:var(--c-text)]"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
