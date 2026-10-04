import { getAttendanceData } from "@/lib/queries";
import Link from "next/link";
import { currentWorkDay, getCashierData, todayShiftsByEmployee } from "@/lib/cashiers";
import { AutoRefresh } from "@/components/AutoRefresh";
import { db } from "@/lib/db";
import { ShiftCalendar } from "@/components/CashierViews";
import { formatDate, formatTime } from "@/lib/format";
import { Card, MetricCard, PageHeader } from "@/components/ui";
import { AttendancePanel } from "@/components/panels/AttendancePanel";

export const dynamic = "force-dynamic";

const RULES = [
  { range: "1–5 daqiqa", text: "Ogohlantirish (ball chegirilmaydi)", bg: "var(--c-primary-light)", border: "var(--c-primary)", fg: "var(--c-primary)" },
  { range: "6–15 daqiqa", text: "−2 ball (KPI Davomat qismidan)", bg: "var(--c-accent-light)", border: "var(--c-accent)", fg: "#92400e" },
  { range: "60+ daqiqa", text: "−10 ball + rahbariyat xabardor", bg: "var(--c-danger-light)", border: "var(--c-danger)", fg: "var(--c-danger)" },
];

/** "YYYY-MM-DD" ga N kun qo'shadi */
function shiftDay(day: string, delta: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export default async function DavomatPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Ko'riladigan kun: ?kun=YYYY-MM-DD, standart — bugungi ish kuni
  const raw = (await searchParams).kun;
  const requested = Array.isArray(raw) ? raw[0] : raw;
  const today = currentWorkDay();
  const day = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && requested <= today ? requested : today;
  const isToday = day === today;
  const dayDate = new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));

  const d = await getAttendanceData(dayDate);
  const now = isToday ? new Date() : new Date(dayDate.getFullYear(), dayDate.getMonth() + 1, 0);
  // Kun smenalari (F-Apteka) — xodimlarga ism bo'yicha bog'lanadi
  const employees = await db.employee.findMany({
    where: { status: { not: "INACTIVE" } },
    select: { id: true, fullName: true, unit: true },
  });
  const smena = await todayShiftsByEmployee(employees, day);
  const presentCount = d.records.filter(
    (r) => r.status === "PRESENT" || r.status === "LATE" || (r.status === null && smena.byEmployee[r.employeeId]),
  ).length;
  const kassa = await getCashierData({
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: now,
    unit: null,
  });

  return (
    <div>
      {/* Bugungi kun ochiq bo'lsa — smenalar har daqiqada yangilanadi */}
      {isToday && <AutoRefresh seconds={60} />}
      <PageHeader
        title="Davomat nazorati"
        subtitle={`${formatDate(dayDate)}${isToday ? " — bugun" : ""}`}
        action={
          <form method="get" className="flex items-center gap-2">
            <Link href={`/davomat?kun=${shiftDay(day, -1)}`} className="btn" aria-label="Oldingi kun">‹</Link>
            <input
              type="date"
              name="kun"
              defaultValue={day}
              max={today}
              className="rounded-lg border border-edge bg-card px-3 py-2 text-sm text-fg outline-none focus:border-primary"
            />
            <button type="submit" className="btn btn-primary">Ko&apos;rsatish</button>
            {!isToday && (
              <>
                <Link href={`/davomat?kun=${shiftDay(day, 1)}`} className="btn" aria-label="Keyingi kun">›</Link>
                <Link href="/davomat" className="btn">Bugun</Link>
              </>
            )}
          </form>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label={isToday ? "Bugun kelganlar" : "Kelganlar"}
          value={`${presentCount}/${d.totalEmployees}`}
          valueColor="var(--c-primary)"
        />
        <MetricCard
          label="Kechikishlar (oy)"
          value={String(d.lateThisMonth)}
          valueColor="var(--c-accent)"
          sub={`Jami penalti: -${d.totalPenalty} ball`}
        />
        <MetricCard
          label="O'rtacha kelish vaqti"
          value={d.avgCheckIn ? formatTime(d.avgCheckIn) : "—"}
          sub="Ish boshlanishi 09:00"
        />
        <MetricCard
          label="Mukammal davomat"
          value={String(d.perfect)}
          valueColor="var(--c-primary)"
          sub="0 kechikish"
        />
      </div>

      <div className="mb-4">
        <AttendancePanel
          records={d.records.map((r) => ({
            employeeId: r.employeeId,
            name: r.name,
            checkIn: r.checkIn ? r.checkIn.toISOString() : null,
            lateMinutes: r.lateMinutes,
            penalty: r.penalty,
            status: r.status,
          }))}
          shifts={Object.fromEntries(
            Object.entries(smena.byEmployee).map(([id, sh]) => [
              id,
              { opened: sh.opened.toISOString(), closed: sh.closed.toISOString(), active: sh.active, checks: sh.checks },
            ]),
          )}
          unmatched={smena.unmatched}
          date={day}
          title={isToday ? "Bugungi davomat" : `${formatDate(dayDate)} davomati`}
        />
      </div>

      <Card title="Kechikish penalti qoidalari" icon="⚠️">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {RULES.map((r) => (
            <div
              key={r.range}
              className="rounded-lg p-3"
              style={{ background: r.bg, borderLeft: `3px solid ${r.border}` }}
            >
              <div className="mb-1 text-xs font-medium" style={{ color: r.fg }}>
                {r.range}
              </div>
              <div className="text-sm">{r.text}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Smenalar bo'yicha ish kunlari (F-Apteka)" icon="🗓️" className="mt-4">
        <ShiftCalendar data={kassa} year={now.getFullYear()} month={now.getMonth() + 1} />
      </Card>
    </div>
  );
}
