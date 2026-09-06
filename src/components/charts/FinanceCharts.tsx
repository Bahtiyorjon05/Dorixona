"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const GREEN = "#1a7f5a";
const BLUE = "#378add";
const AMBER = "#f59e0b";
const GRAY = "#94a3b8";
const RED = "#e24b4a";
const DONUT_COLORS = [GREEN, BLUE, AMBER, GRAY, RED];

type Point = { label: string; value: number };
type Series = { label: string; savdo: number; xarajat: number };

const AXIS = { fontSize: 11, fill: "var(--c-muted)" } as const;

/** Bo'sh ma'lumot holati — grafik o'rniga izoh. */
function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-edge">
      <p className="px-6 text-center text-sm text-muted">{text}</p>
    </div>
  );
}

function tooltipStyle() {
  return {
    contentStyle: {
      background: "var(--c-card)",
      border: "1px solid var(--c-edge)",
      borderRadius: 8,
      fontSize: 12,
    },
    labelStyle: { color: "var(--c-muted)" },
  };
}

/** Savdo dinamikasi — Kun / Oy / 6 oy tugmalari bilan. */
export function SavdoChart({
  week,
  month,
  sixMonth,
}: {
  week: Point[];
  month: Point[];
  sixMonth: Point[];
}) {
  const [range, setRange] = useState<"kun" | "oy" | "6oy">("kun");
  const data = range === "kun" ? week : range === "oy" ? month : sixMonth;
  const hasData = data.some((d) => d.value > 0);

  const TABS: { key: typeof range; label: string }[] = [
    { key: "kun", label: "Kun" },
    { key: "oy", label: "Oy" },
    { key: "6oy", label: "6 oy" },
  ];

  return (
    <div>
      <div className="mb-3 flex justify-end gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setRange(t.key)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              range === t.key ? "bg-primary-light text-primary" : "text-muted hover:bg-surface"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {hasData ? (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--c-edge)" />
            <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}M`} />
            <Tooltip {...tooltipStyle()} formatter={(v) => `${v}M so'm`} />
            <Bar dataKey="value" fill={GREEN} radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <Empty text="Kassada (POS) hali savdo qayd etilmagan, shuning uchun grafik bo'sh." />
      )}
    </div>
  );
}

/** Toifalar ulushi — donut. */
export function ToifalarChart({ data }: { data: { name: string; value: number }[] }) {
  const clean = data.filter((d) => d.value > 0);
  if (clean.length === 0) {
    return <Empty text="Savdo bo'lmagani uchun toifalar ulushi hisoblanmadi." />;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={clean}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
        >
          {clean.map((entry, i) => (
            <Cell key={entry.name} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle()} formatter={(v) => `${v}%`} />
        <Legend
          verticalAlign="middle"
          align="right"
          layout="vertical"
          iconType="circle"
          wrapperStyle={{ fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** 6 oylik savdo va harajat — chiziqli grafik. */
export function FoydaXarajatChart({ data }: { data: Series[] }) {
  const hasData = data.some((d) => d.savdo > 0 || d.xarajat > 0);
  if (!hasData) {
    return <Empty text="Oxirgi 6 oyda savdo yoki harajat yozuvi topilmadi." />;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="savdoFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GREEN} stopOpacity={0.25} />
            <stop offset="100%" stopColor={GREEN} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--c-edge)" />
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}M`} />
        <Tooltip {...tooltipStyle()} formatter={(v) => `${v}M so'm`} />
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: 12 }}
          formatter={(v) => (v === "savdo" ? "Savdo" : "Harajat")}
        />
        <Area
          type="monotone"
          dataKey="savdo"
          stroke={GREEN}
          strokeWidth={2}
          fill="url(#savdoFill)"
          dot={{ r: 3, fill: GREEN }}
        />
        <Area
          type="monotone"
          dataKey="xarajat"
          stroke={RED}
          strokeWidth={2}
          strokeDasharray="5 4"
          fill="transparent"
          dot={{ r: 3, fill: RED }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Xodim va foyda korrelyatsiyasi — hisobotlar uchun. */
export function KorrelyatsiyaChart({
  data,
}: {
  data: { name: string; value: number; kpi: number }[];
}) {
  if (data.length === 0) {
    return <Empty text="KPI yoki savdo ma'lumoti yo'q." />;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--c-edge)" />
        <XAxis
          dataKey="name"
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: string) => v.split(" ")[0]}
        />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}M`} />
        <Tooltip {...tooltipStyle()} formatter={(v) => `${v}M so'm`} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={64}>
          {data.map((entry, i) => (
            <Cell key={entry.name} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
