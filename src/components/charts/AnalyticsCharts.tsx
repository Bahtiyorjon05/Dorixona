"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
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
const VIOLET = "#8b5cf6";
const CATEGORY_COLORS = [GREEN, BLUE, AMBER, VIOLET, RED, GRAY, "#0ea5e9"];

const AXIS = { fontSize: 11, fill: "var(--c-muted)" } as const;

const LABELS: Record<string, string> = {
  savdo: "Savdo",
  foyda: "Foyda",
  astatka: "Astatka",
  xarajat: "Harajat",
};

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

function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed border-edge">
      <p className="px-6 text-center text-sm text-muted">{text}</p>
    </div>
  );
}

type MonthPoint = { label: string; savdo: number; foyda: number; astatka: number; xarajat: number };
type UnitPoint = { unit: string; savdo: number; foyda: number; astatka: number };

/** Savdo va foyda dinamikasi — chiziqli (F-Apteka "Динамика продаж" kabi). */
export function DinamikaChart({ data }: { data: MonthPoint[] }) {
  if (data.length === 0) {
    return <Empty text="Oylik moliya ma'lumoti hali kiritilmagan." />;
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--c-edge)" />
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}M`} />
        <Tooltip {...tooltipStyle()} formatter={(v) => `${v} mln so'm`} />
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: 12 }}
          formatter={(v) => LABELS[String(v)] ?? String(v)}
        />
        <Line type="monotone" dataKey="savdo" stroke={GREEN} strokeWidth={2.5} dot={{ r: 3, fill: GREEN }} />
        <Line type="monotone" dataKey="foyda" stroke={BLUE} strokeWidth={2} dot={{ r: 3, fill: BLUE }} />
        <Line
          type="monotone"
          dataKey="xarajat"
          stroke={RED}
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={{ r: 3, fill: RED }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Astatka dinamikasi — maydonli (F-Apteka "Динамика остатков" kabi). */
export function AstatkaChart({ data }: { data: MonthPoint[] }) {
  if (data.length === 0) {
    return <Empty text="Astatka ma'lumoti hali yo'q." />;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="astatkaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={AMBER} stopOpacity={0.3} />
            <stop offset="100%" stopColor={AMBER} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--c-edge)" />
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}M`} />
        <Tooltip {...tooltipStyle()} formatter={(v) => `${v} mln so'm`} />
        <Area
          type="monotone"
          dataKey="astatka"
          name="Astatka"
          stroke={AMBER}
          strokeWidth={2.5}
          fill="url(#astatkaFill)"
          dot={{ r: 3, fill: AMBER }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Dorixonalar taqqoslashi — savdo va astatka (F-Apteka "ПРОДАЖИ / ОСТАТОК" kabi). */
export function FiliallarChart({ data }: { data: UnitPoint[] }) {
  if (data.length === 0) {
    return <Empty text="Filial kesimida ma'lumot yo'q." />;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--c-edge)" />
        <XAxis dataKey="unit" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}M`} />
        <Tooltip {...tooltipStyle()} formatter={(v) => `${v} mln so'm`} />
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: 12 }}
          formatter={(v) => LABELS[String(v)] ?? String(v)}
        />
        <Bar dataKey="savdo" fill={GREEN} radius={[4, 4, 0, 0]} maxBarSize={44} />
        <Bar dataKey="foyda" fill={BLUE} radius={[4, 4, 0, 0]} maxBarSize={44} />
        <Bar dataKey="astatka" fill={AMBER} radius={[4, 4, 0, 0]} maxBarSize={44} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Ombor qiymati toifa bo'yicha — donut. */
export function OmborToifaChart({ data }: { data: { name: string; value: number }[] }) {
  const clean = data.filter((d) => d.value > 0);
  if (clean.length === 0) {
    return <Empty text="Ombor bo'sh yoki qoldiq ma'lumoti yo'q." />;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={clean}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
        >
          {clean.map((entry, i) => (
            <Cell key={entry.name} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle()} formatter={(v) => `${v} mln so'm`} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
