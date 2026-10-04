"use client";

import { useMemo, useState } from "react";
import { formatDate, formatNumber, formatSom, formatTime } from "@/lib/format";

export type ShiftRow = {
  id: string;
  unit: string;
  cashier: string;
  opened: string;
  closed: string;
  hours: number;
  checks: number;
  net: number;
};

const TZ = process.env.NEXT_PUBLIC_APP_TIMEZONE?.trim() || "Asia/Tashkent";
/** ISO vaqt -> Toshkent sanasi "YYYY-MM-DD" */
const localDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
const hours = (value: number) => `${value.toFixed(1).replace(".", ",")} s`;

const control =
  "rounded-lg border border-edge bg-card px-3 py-1.5 text-sm text-fg outline-none focus:border-primary";

/** Smenalar ro'yxati — sana, kassir va dorixona bo'yicha qidiruv bilan */
export function ShiftTable({ shifts, limit = 100 }: { shifts: ShiftRow[]; limit?: number }) {
  const [day, setDay] = useState("");
  const [query, setQuery] = useState("");
  const [unit, setUnit] = useState("");
  const units = useMemo(() => [...new Set(shifts.map((s) => s.unit))].sort(), [shifts]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return shifts.filter(
      (s) =>
        (!day || localDay(s.opened) === day) &&
        (!unit || s.unit === unit) &&
        (!q || s.cashier.toLowerCase().includes(q)),
    );
  }, [shifts, day, unit, query]);

  const totalChecks = shown.reduce((sum, s) => sum + s.checks, 0);
  const totalNet = shown.reduce((sum, s) => sum + s.net, 0);
  const filtered = Boolean(day || unit || query.trim());

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={control} aria-label="Sana" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Kassir ismi..."
          className={`${control} w-full sm:w-48`}
        />
        <select value={unit} onChange={(e) => setUnit(e.target.value)} className={control} aria-label="Dorixona">
          <option value="">Hamma dorixona</option>
          {units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        {filtered && (
          <button
            type="button"
            onClick={() => { setDay(""); setQuery(""); setUnit(""); }}
            className="rounded-lg border border-edge px-3 py-1.5 text-xs hover:bg-surface"
          >
            Tozalash
          </button>
        )}
        <span className="ml-auto text-xs text-muted">
          {formatNumber(shown.length)} smena · {formatNumber(totalChecks)} chek · {formatSom(totalNet)}
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">Topilmadi.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-left">Sana</th>
                <th className="text-left">Dorixona</th>
                <th className="text-left">Kassir</th>
                <th>Ochildi</th>
                <th>Yopildi</th>
                <th>Soat</th>
                <th>Chek</th>
                <th>Savdo</th>
              </tr>
            </thead>
            <tbody>
              {shown.slice(0, limit).map((s) => (
                <tr key={s.id}>
                  <td className="text-left">{formatDate(s.opened)}</td>
                  <td className="text-left text-muted">{s.unit}</td>
                  <td className="text-left font-medium">{s.cashier}</td>
                  <td>{formatTime(s.opened)}</td>
                  <td>{formatTime(s.closed)}</td>
                  <td>{hours(s.hours)}</td>
                  <td>{formatNumber(s.checks)}</td>
                  <td>{formatSom(s.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length > limit && (
            <p className="mt-2 text-xs text-muted">Birinchi {limit} ta ko&apos;rsatildi — sana yoki kassir bo&apos;yicha toraytiring.</p>
          )}
        </div>
      )}
    </div>
  );
}
