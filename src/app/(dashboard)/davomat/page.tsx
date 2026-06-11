import { getAttendanceData } from "@/lib/queries";
import { formatTime, monthName } from "@/lib/format";
import { Card, MetricCard, PageHeader } from "@/components/ui";
import { AttendancePanel } from "@/components/panels/AttendancePanel";

export const dynamic = "force-dynamic";

const RULES = [
  { range: "1–5 daqiqa", text: "Ogohlantirish (ball chegirilmaydi)", bg: "var(--c-primary-light)", border: "var(--c-primary)", fg: "var(--c-primary)" },
  { range: "6–15 daqiqa", text: "−2 ball (KPI Davomat qismidan)", bg: "var(--c-accent-light)", border: "var(--c-accent)", fg: "#92400e" },
  { range: "60+ daqiqa", text: "−10 ball + rahbariyat xabardor", bg: "var(--c-danger-light)", border: "var(--c-danger)", fg: "var(--c-danger)" },
];

export default async function DavomatPage() {
  const d = await getAttendanceData();
  const now = new Date();

  return (
    <div>
      <PageHeader
        title="Davomat nazorati"
        subtitle={`${monthName(now.getMonth() + 1)} ${now.getFullYear()} — kechikish va penalti tizimi`}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Bugun kelganlar"
          value={`${d.presentCount}/${d.totalEmployees}`}
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
    </div>
  );
}
