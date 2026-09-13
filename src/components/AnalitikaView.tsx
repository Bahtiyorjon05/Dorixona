"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatNumber } from "@/lib/format";
import { Card } from "@/components/ui";
import {
  AstatkaChart,
  DinamikaChart,
  FiliallarChart,
  OmborToifaChart,
} from "@/components/charts/AnalyticsCharts";

type MonthPoint = { label: string; savdo: number; foyda: number; astatka: number; xarajat: number };
type UnitPoint = { unit: string; savdo: number; foyda: number; astatka: number };

type Props = {
  year: number;
  monthly: MonthPoint[];
  byUnit: UnitPoint[];
  lastMonthName: string | null;
  inventoryByCategory: { name: string; value: number }[];
  inventoryTotal: number;
};

// F-Apteka "Графики" ro'yxatiga o'xshash — bizda bor grafiklar
const CHARTS = [
  { key: "dinamika", label: "Savdo va foyda dinamikasi" },
  { key: "astatka", label: "Astatka dinamikasi" },
  { key: "filiallar", label: "Dorixonalar taqqoslashi" },
  { key: "ombor", label: "Ombor qiymati (toifalar)" },
] as const;

type ChartKey = (typeof CHARTS)[number]["key"];

export function AnalitikaView({
  year,
  monthly,
  byUnit,
  lastMonthName,
  inventoryByCategory,
  inventoryTotal,
}: Props) {
  const router = useRouter();
  const [chart, setChart] = useState<ChartKey>("dinamika");

  const now = new Date().getFullYear();
  const years = [now + 1, now, now - 1, now - 2];

  const selectClass =
    "rounded-lg border border-edge bg-transparent px-3 py-2 text-sm outline-none focus:border-primary";

  const active = CHARTS.find((c) => c.key === chart)!;

  return (
    <div>
      {/* Tanlash paneli — F-Apteka "Графики / С / По" kabi */}
      <Card title="Ko'rsatkich tanlash" icon="🎛️" className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Grafik
            <select
              value={chart}
              onChange={(e) => setChart(e.target.value as ChartKey)}
              className={`${selectClass} min-w-[220px]`}
            >
              {CHARTS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted">
            Yil
            <select
              value={year}
              onChange={(e) => router.push(`/analitika?yil=${e.target.value}`)}
              className={selectClass}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      <Card
        title={active.label}
        icon="📈"
        className="mb-4"
      >
        {chart === "dinamika" && (
          <>
            <p className="mb-3 text-sm text-muted">{year}-yil oylik ko&apos;rsatkichlar (mln so&apos;m)</p>
            <DinamikaChart data={monthly} />
          </>
        )}
        {chart === "astatka" && (
          <>
            <p className="mb-3 text-sm text-muted">{year}-yil oxiridagi qoldiq qiymati (mln so&apos;m)</p>
            <AstatkaChart data={monthly} />
          </>
        )}
        {chart === "filiallar" && (
          <>
            <p className="mb-3 text-sm text-muted">
              {lastMonthName ? `${lastMonthName} oyi` : "Oxirgi oy"} — dorixonalar kesimi (mln so&apos;m)
            </p>
            <FiliallarChart data={byUnit} />
          </>
        )}
        {chart === "ombor" && (
          <>
            <p className="mb-3 text-sm text-muted">
              Hozirgi qoldiq chakana narxda, jami {formatNumber(inventoryTotal)} mln so&apos;m
            </p>
            <OmborToifaChart data={inventoryByCategory} />
          </>
        )}
      </Card>
    </div>
  );
}
