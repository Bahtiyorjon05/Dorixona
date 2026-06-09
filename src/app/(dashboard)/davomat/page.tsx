import { getAttendanceData } from "@/lib/queries";
import { formatTime, monthName } from "@/lib/format";
import { Badge, Card, MetricCard, PageHeader } from "@/components/ui";

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

      <Card title="Bugungi davomat jadvali" icon="📅" className="mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge text-left text-[11px] uppercase text-muted">
                <th className="pb-2 pr-3 font-medium">Xodim</th>
                <th className="pb-2 pr-3 font-medium">Kelish</th>
                <th className="pb-2 pr-3 font-medium">Kechikish</th>
                <th className="pb-2 pr-3 font-medium">Penalti</th>
                <th className="pb-2 font-medium">Holat</th>
              </tr>
            </thead>
            <tbody>
              {d.records.map((r) => (
                <tr key={r.id} className="border-b border-edge last:border-0 hover:bg-surface">
                  <td className="py-2.5 pr-3 font-medium">{r.name}</td>
                  {r.status === "ON_LEAVE" ? (
                    <td colSpan={3} className="py-2.5 pr-3 italic text-muted">
                      Ta'tilda (ruxsatli)
                    </td>
                  ) : (
                    <>
                      <td className="py-2.5 pr-3">{r.checkIn ? formatTime(r.checkIn) : "—"}</td>
                      <td
                        className="py-2.5 pr-3"
                        style={{ color: r.lateMinutes > 5 ? "var(--c-danger)" : "var(--c-primary)" }}
                      >
                        {r.lateMinutes > 0 ? `${r.lateMinutes} min` : "0"}
                      </td>
                      <td
                        className="py-2.5 pr-3"
                        style={{ color: r.penalty > 0 ? "var(--c-danger)" : "var(--c-primary)" }}
                      >
                        {r.penalty > 0 ? `-${r.penalty} ball` : "0"}
                      </td>
                    </>
                  )}
                  <td className="py-2.5">
                    {r.status === "ON_LEAVE" ? (
                      <Badge color="blue">Ta'til</Badge>
                    ) : r.lateMinutes > 5 ? (
                      <Badge color="amber">Kechikdi</Badge>
                    ) : (
                      <Badge color="green">Keldi</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

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
