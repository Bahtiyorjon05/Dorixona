"use client";

import { useState } from "react";
import { SalesBarChart } from "@/components/ChartsLazy";

type Series = { label: string; value: number }[];

const TABS = [
  { key: "week", label: "7 kun" },
  { key: "month", label: "Shu oy" },
  { key: "halfyear", label: "6 oy" },
] as const;

export function SalesChartTabs({
  week,
  month,
  halfyear,
}: {
  week: Series;
  month: Series;
  halfyear: Series;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("week");
  const data = tab === "week" ? week : tab === "month" ? month : halfyear;

  return (
    <div className="card p-4">
      <div className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium">📊 Savdo dinamikasi</span>
        <div className="flex gap-1 rounded-lg bg-surface p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-md px-3 py-1 text-xs transition ${
                tab === t.key ? "bg-card font-medium shadow-sm" : "text-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <SalesBarChart data={data} />
    </div>
  );
}
