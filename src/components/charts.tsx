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
const AXIS = { fontSize: 11, fill: "#6b7280" };
const grid = "rgba(128,128,128,0.12)";

const mln = (v: number) => `${v}M`;

/** Savdo dinamikasi (ustunli) — qiymatlar mln so'mda */
export function SalesBarChart({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={mln} tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(v) => [`${Number(v).toFixed(1)}M so'm`, "Savdo"]}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Bar dataKey="value" fill="#2da876" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Toifalar ulushi (doughnut) */
export function CategoryDonut({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={45}
          outerRadius={70}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          iconType="circle"
          wrapperStyle={{ fontSize: 11 }}
        />
        <Tooltip
          formatter={(v, n) => [`${v}%`, n]}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Foyda va xarajat (chiziqli, to'ldirilgan) */
export function ProfitLineChart({
  data,
}: {
  data: { label: string; savdo: number; xarajat: number }[];
}) {
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
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Area
          type="monotone"
          dataKey="savdo"
          name="Savdo"
          stroke="#2da876"
          fill="url(#gSavdo)"
          strokeWidth={2}
        />
        <Line
          type="monotone"
          dataKey="xarajat"
          name="Xarajat"
          stroke="#e24b4a"
          strokeWidth={2}
          strokeDasharray="4 2"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Xodim KPI va foyda korrelyatsiyasi */
export function CorrelationBarChart({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={mln} tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(v) => [`${Number(v).toFixed(1)}M so'm`, "Foyda"]}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
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
