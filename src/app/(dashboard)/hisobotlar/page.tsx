import { getReportsData } from "@/lib/queries";
import { Badge, Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

function CorrelationBars({ data }: { data: { label: string; value: number; kpi: number }[] }) {
  const max = Math.max(...data.map((item) => item.value), 0.01);
  return (
    <div className="space-y-3">
      {data.length ? data.map((item) => (
        <div key={item.label} className="grid grid-cols-[120px_1fr_70px] items-center gap-3 text-xs">
          <span className="truncate text-muted">{item.label}</span>
          <div className="h-3 overflow-hidden rounded-full bg-surface">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }} />
          </div>
          <span className="text-right text-muted">{item.value}M · KPI {item.kpi}</span>
        </div>
      )) : <p className="text-sm text-muted">Savdo ma'lumotlari to'planmoqda.</p>}
    </div>
  );
}

export default async function HisobotlarPage() {
  const d = await getReportsData();

  const tips = [
    {
      bg: "var(--c-primary-light)",
      border: "var(--c-primary)",
      text:
        d.correlation[0]
          ? `${d.correlation[0].label.split(" ")[0]} bu oyda eng ko'p foyda keltirdi — uning sotgan toifalarini tahlil qiling`
          : "Savdo ma'lumotlari to'planmoqda",
    },
    {
      bg: "var(--c-accent-light)",
      border: "var(--c-accent)",
      text: d.critical
        ? `${d.critical} ombori kritik darajada — zudlik bilan buyurtma bering`
        : "Ombor qoldiqlari normal darajada",
    },
    {
      bg: "var(--c-info-light)",
      border: "var(--c-info)",
      text: "KPI va moliya birlashgan tahlil yangi insight beradi — yuqori KPI yuqori foyda bilan bog'liq",
    },
  ];

  return (
    <div>
      <PageHeader title="Hisobotlar va tahlil" subtitle="KPI va moliya integratsiyasi" />

      <Card
        title="Xodim va foyda korrelyatsiyasi"
        icon="📈"
        action={<Badge color="green">Yangi insight</Badge>}
        className="mb-4"
      >
        <p className="mb-4 text-sm text-muted">
          Qaysi xodim qancha foyda keltirdi — KPI va moliya birlashgan tahlil (joriy oy, mln so'm)
        </p>
        <CorrelationBars data={d.correlation} />
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Hisobot eksport" icon="⬇️">
          <div className="flex flex-col gap-2">
            {[
              { icon: "📊", label: "Oylik KPI hisoboti (.xlsx)", href: "/api/export/kpi?format=xlsx" },
              { icon: "📑", label: "Oylik KPI hisoboti (.csv)", href: "/api/export/kpi?format=csv" },
              { icon: "💰", label: "Moliyaviy hisobot (.xlsx)", href: "/api/export/finance?format=xlsx" },
              { icon: "🕐", label: "Davomat jadvali (.csv)", href: "/api/export/attendance?format=csv" },
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
    </div>
  );
}
