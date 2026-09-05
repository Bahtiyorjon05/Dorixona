"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setFilial } from "@/lib/actions/filial";
import { FILIALS, type Filial } from "@/lib/filial";

const ICON: Record<Filial, string> = {
  Umumiy: "🏢",
  Yunusobod: "🏪",
  Qoraqamish: "🏪",
};

export function FilialSwitcher({ current }: { current: Filial }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function pick(value: Filial) {
    if (value === current || pending) return;
    start(async () => {
      await setFilial(value);
      router.refresh();
    });
  }

  return (
    <div
      className="flex items-center gap-0.5 rounded-lg border border-edge bg-surface p-0.5"
      role="group"
      aria-label="Filial tanlash"
    >
      {FILIALS.map((f) => {
        const active = f === current;
        return (
          <button
            key={f}
            type="button"
            onClick={() => pick(f)}
            disabled={pending}
            aria-pressed={active}
            title={f === "Umumiy" ? "Barcha filiallar" : `${f} filiali`}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition disabled:opacity-60 ${
              active ? "bg-card text-primary shadow-sm" : "text-muted hover:text-fg"
            }`}
          >
            <span className="mr-1">{ICON[f]}</span>
            <span className="hidden sm:inline">{f}</span>
            <span className="sm:hidden">{f === "Umumiy" ? "Hammasi" : f.slice(0, 4)}</span>
          </button>
        );
      })}
    </div>
  );
}
