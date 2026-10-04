import { formatDate, formatNumber, formatSom, formatTime } from "@/lib/format";
import type { CashierData } from "@/lib/cashiers";

/**
 * Kassirlar va smenalar (F-Apteka cheklaridan) — Savdo, KPI, Hisobotlar va
 * Davomat sahifalari shu bloklardan foydalanadi.
 */

const hours = (value: number) => `${value.toFixed(1).replace(".", ",")} s`;

export function CashierEmpty({ data }: { data: CashierData }) {
  return (
    <p className="py-4 text-center text-sm text-muted">
      {data.known
        ? "Bu davr uchun smena ma'lumoti yo'q."
        : "Kassir smenalari hali ulanmagan: Supabase'da prisma/manual/kassir-smenalari.sql ni ishga tushiring."}
    </p>
  );
}

/** Kassirlar bo'yicha jami */
export function CashierTotals({ data }: { data: CashierData }) {
  if (!data.cashiers.length) return <CashierEmpty data={data} />;
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th className="text-left">Kassir</th>
            <th className="text-left">Dorixona</th>
            <th>Smena</th>
            <th>Kun</th>
            <th>Soat</th>
            <th>Chek</th>
            <th>Savdo</th>
            <th>O&apos;rtacha chek</th>
            <th>Ulush</th>
          </tr>
        </thead>
        <tbody>
          {data.cashiers.map((row) => (
            <tr key={row.key}>
              <td className="text-left font-medium">{row.cashier}</td>
              <td className="text-left text-muted">{row.unit}</td>
              <td>{formatNumber(row.shifts)}</td>
              <td>{formatNumber(row.days)}</td>
              <td>{hours(row.hours)}</td>
              <td>{formatNumber(row.checks)}</td>
              <td>{formatSom(row.net)}</td>
              <td>{formatSom(Math.round(row.avgCheck))}</td>
              <td>{row.share.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Smenalar ro'yxati (yangisi birinchi) */
export function ShiftList({ data, limit = 60 }: { data: CashierData; limit?: number }) {
  if (!data.shifts.length) return <CashierEmpty data={data} />;
  return (
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
          {data.shifts.slice(0, limit).map((shift) => (
            <tr key={shift.id}>
              <td className="text-left">{formatDate(shift.openedAt)}</td>
              <td className="text-left text-muted">{shift.unit}</td>
              <td className="text-left font-medium">{shift.cashier}</td>
              <td>{formatTime(shift.openedAt)}</td>
              <td>{formatTime(shift.closedAt)}</td>
              <td>{hours(shift.hours)}</td>
              <td>{formatNumber(shift.checks)}</td>
              <td>{formatSom(shift.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.shifts.length > limit && (
        <p className="mt-2 text-xs text-muted">Oxirgi {limit} ta smena ko&apos;rsatildi.</p>
      )}
    </div>
  );
}

/** Davomat: kassir × oy kunlari, katakda ishlagan soat */
export function ShiftCalendar({ data, year, month }: { data: CashierData; year: number; month: number }) {
  if (!data.calendar.length) return <CashierEmpty data={data} />;
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const key = (day: number) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return (
    <div className="overflow-x-auto">
      <table className="data-table text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-card text-left">Kassir</th>
            {days.map((day) => (
              <th key={day} className="px-1">{day}</th>
            ))}
            <th>Kun</th>
            <th>Soat</th>
          </tr>
        </thead>
        <tbody>
          {data.calendar.map((row) => {
            const worked = days.filter((day) => row.days[key(day)]);
            const total = worked.reduce((sum, day) => sum + row.days[key(day)], 0);
            return (
              <tr key={row.key}>
                <td className="sticky left-0 bg-card text-left">
                  <div className="font-medium">{row.cashier}</div>
                  <div className="text-[11px] text-muted">{row.unit}</div>
                </td>
                {days.map((day) => {
                  const value = row.days[key(day)];
                  return (
                    <td
                      key={day}
                      className="px-1"
                      style={value ? { background: "var(--c-primary-light)", color: "var(--c-primary)" } : undefined}
                      title={value ? `${hours(value)} — birinchi va oxirgi chek oralig'i` : undefined}
                    >
                      {value ? Math.round(value) : ""}
                    </td>
                  );
                })}
                <td className="font-medium">{worked.length}</td>
                <td>{hours(total)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
