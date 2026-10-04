import { getReportInsights } from "@/lib/report-insights";
import { getCashierData } from "@/lib/cashiers";
import { CashierTotals } from "@/components/CashierViews";
import { Badge, Card, PageHeader } from "@/components/ui";
import { AutoRefresh } from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

type Row = { key: string; label: string; unit: string; net: number; profit: number | null; kpi: number | null };

/** Kassirlar: foyda (tan narx bo'lsa) yoki savdo, KPI balli bilan */
function CorrelationBars({ data }: { data: Row[] }) {
  const value = (row: Row) => row.profit ?? row.net;
  const max = Math.max(...data.map(value), 1);
  const sorted = [...data].sort((a, b) => value(b) - value(a));
  return (
    <div className="space-y-3">
      {sorted.length ? sorted.map((item) => (
        <div key={item.key} className="grid grid-cols-[140px_1fr_150px] items-center gap-3 text-xs">
          <span className="truncate" title={item.unit}>
            {item.label} <span className="text-muted">· {item.unit}</span>
          </span>
          <div className="h-3 overflow-hidden rounded-full bg-surface">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (value(item) / max) * 100)}%` }} />
          </div>
          <span className="text-right text-muted">
            {(value(item) / 1_000_000).toFixed(1)}M{item.kpi !== null ? ` · KPI ${item.kpi}` : ""}
          </span>
        </div>
      )) : <p className="text-sm text-muted">Shu oy smena ma&apos;lumoti hali kelmagan.</p>}
    </div>
  );
}

const TONE: Record<string, { bg: string; border: string }> = {
  good: { bg: "var(--c-primary-light)", border: "var(--c-primary)" },
  warn: { bg: "var(--c-accent-light)", border: "var(--c-accent)" },
  bad: { bg: "var(--c-danger-light)", border: "var(--c-danger)" },
  info: { bg: "var(--c-info-light)", border: "var(--c-info)" },
};

export default async function HisobotlarPage() {
  const insight = await getReportInsights();
  const kassaNow = new Date();
  const kassa = await getCashierData({
    from: new Date(kassaNow.getFullYear(), kassaNow.getMonth(), 1),
    to: kassaNow,
    unit: null,
  });

  const tips = insight.insights.map((item) => ({ ...TONE[item.tone], text: item.text }));

  return (
    <div>
      <AutoRefresh seconds={120} />
      <PageHeader title="Hisobotlar va tahlil" subtitle="KPI va moliya integratsiyasi" />

      <Card
        title="Xodim va foyda korrelyatsiyasi"
        icon="📈"
        action={<Badge color="green">Yangi insight</Badge>}
        className="mb-4"
      >
        <p className="mb-4 text-sm text-muted">
          {insight.hasCost
            ? "Har bir kassir shu oy qancha foyda keltirdi (QQSsiz, mln so'm) va KPI balli"
            : "Har bir kassir shu oy qancha savdo qildi (mln so'm) va KPI balli"}
        </p>
        <CorrelationBars data={insight.correlation} />
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Hisobot eksport" icon="⬇️">
          <div className="flex flex-col gap-2">
            {[
              { icon: "📊", label: "Oylik KPI hisoboti (.xlsx)", href: "/api/export/kpi?format=xlsx" },
              { icon: "📑", label: "Oylik KPI hisoboti (.csv)", href: "/api/export/kpi?format=csv" },
              { icon: "💰", label: "Moliyaviy hisobot — yil, dorixonalar (.xlsx)", href: "/api/export/finance?format=xlsx" },
              { icon: "🧑‍💼", label: "Kassirlar va smenalar — shu oy (.xlsx)", href: "/api/export/kassirlar?format=xlsx" },
              { icon: "🕐", label: "Davomat — shu oy, smenalar bilan (.xlsx)", href: "/api/export/attendance?format=xlsx" },
            ].map((b) => (
              <a
                key={b.label}
                href={b.href}
                className="flex items-center gap-2 rounded-lg border border-edge px-3 py-2 text-sm hover:bg-surface"
              >
                <span>{b.icon}</span>
                {b.label}
              </a>
            ))}
            <div className="mt-1 border-t border-edge pt-2 text-[11px] uppercase tracking-wider text-muted">
              PDF (chop etish)
            </div>
            {[
              { label: "KPI hisoboti (PDF)", href: "/chop/kpi" },
              { label: "Moliyaviy hisobot (PDF)", href: "/chop/finance" },
              { label: "Kassirlar va smenalar (PDF)", href: "/chop/kassirlar" },
              { label: "Davomat (PDF)", href: "/chop/attendance" },
            ].map((b) => (
              <a
                key={b.label}
                href={b.href}
                target="_blank"
                className="flex items-center gap-2 rounded-lg border border-edge px-3 py-2 text-sm hover:bg-surface"
              >
                <span>📄</span>
                {b.label}
              </a>
            ))}
          </div>
        </Card>

        <Card title="AI tavsiyalar" icon="🤖">
          <div className="flex flex-col gap-2.5 text-sm">
            {tips.map((t, i) => (
              <div
                key={i}
                className="rounded-lg p-2.5"
                style={{ background: t.bg, borderLeft: `2px solid ${t.border}` }}
              >
                {t.text}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Kassirlar bo'yicha savdo — shu oy" icon="🧑‍💼" className="mt-4">
        <CashierTotals data={kassa} />
      </Card>
    </div>
  );
}
