"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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

const PALETTE = ["#2da876", "#378add", "#f59e0b", "#888780", "#7f77dd", "#e24b4a"];
const AXIS = { fontSize: 11, fill: "#8b8f93" } as const;

// HTML asosidagi tooltip — CSS o'zgaruvchilari orqali temaga moslashadi
const tooltipStyle = {
  fontSize: 12,
  borderRadius: 8,
  background: "var(--c-bg)",
  border: "1px solid var(--c-border)",
  color: "var(--c-text)",
} as const;
const itemStyle = { color: "var(--c-text)" } as const;
const legendStyle = { fontSize: 11, color: "var(--c-muted)" } as const;

const mln = (v: number) => `${v}M`;

export function SalesBarChart({ data }: { data: { label: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={mln} tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(v) => [`${Number(v).toFixed(1)}M so'm`, "Savdo"]}
          contentStyle={tooltipStyle}
          itemStyle={itemStyle}
          labelStyle={itemStyle}
          cursor={{ fill: "var(--c-chart-grid)" }}
        />
        <Bar dataKey="value" fill="#2da876" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CategoryDonut({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" wrapperStyle={legendStyle} />
        <Tooltip
          formatter={(v, n) => [`${v}%`, n]}
          contentStyle={tooltipStyle}
          itemStyle={itemStyle}
          labelStyle={itemStyle}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ProfitLineChart({ data }: { data: { label: string; savdo: number; xarajat: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="gSavdo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2da876" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#2da876" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={mln} tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(v, n) => [`${v}M so'm`, n === "savdo" ? "Savdo" : "Xarajat"]}
          contentStyle={tooltipStyle}
          itemStyle={itemStyle}
          labelStyle={itemStyle}
        />
        <Legend wrapperStyle={legendStyle} />
        <Area type="monotone" dataKey="savdo" name="Savdo" stroke="#2da876" fill="url(#gSavdo)" strokeWidth={2} />
        <Line type="monotone" dataKey="xarajat" name="Xarajat" stroke="#e24b4a" strokeWidth={2} strokeDasharray="4 2" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CorrelationBarChart({ data }: { data: { label: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={mln} tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(v) => [`${Number(v).toFixed(1)}M so'm`, "Foyda"]}
          contentStyle={tooltipStyle}
          itemStyle={itemStyle}
          labelStyle={itemStyle}
          cursor={{ fill: "var(--c-chart-grid)" }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
