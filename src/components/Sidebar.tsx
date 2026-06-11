"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: { section?: string; items: { href: string; label: string; icon: string }[] }[] = [
  {
    items: [
      { href: "/moliya", label: "Moliya", icon: "📈" },
      { href: "/harajatlar", label: "Harajatlar", icon: "🧾" },
      { href: "/ombor", label: "Ombor", icon: "📦" },
      { href: "/pos", label: "Kassa (POS)", icon: "🛒" },
      { href: "/mijozlar", label: "Mijozlar", icon: "🪪" },
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

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <>
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
                onClick={onNavigate}
                className={`mx-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-primary-light font-medium text-primary"
                    : "text-muted hover:bg-surface hover:text-fg"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}

/** Desktop yon panel */
export function Sidebar() {
  return (
    <aside className="hidden w-56 flex-shrink-0 flex-col gap-1 border-r border-edge bg-card py-4 md:flex">
      <NavLinks />
    </aside>
  );
}

/** Mobil — gamburger tugma + chiqib keladigan panel */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(true)}
        aria-label="Menyu"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-edge text-lg hover:bg-surface"
      >
        ☰
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside
            className="relative flex w-60 flex-col gap-1 border-r border-edge bg-card py-4"
            onClick={(e) => e.stopPropagation()}
          >
            <NavLinks onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </div>
  );
}
