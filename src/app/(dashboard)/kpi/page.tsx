import { getKpiData } from "@/lib/queries";
import { formatNumber, monthName } from "@/lib/format";
import { KPI_WEIGHTS } from "@/lib/kpi";
import { Badge, Card, MetricCard, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const RANK_BG = ["#fef3c7", "#f1f5f9", "#fdf4e7"];
const RANK_FG = ["#92400e", "#475569", "#92400e"];

function scoreColor(s: number) {
  if (s >= 90) return "var(--c-primary)";
  if (s >= 80) return "var(--c-accent)";
  return "var(--c-danger)";
}
function bonusBadge(p: number): "green" | "amber" | "red" {
  if (p >= 20) return "green";
  if (p >= 5) return "amber";
  return "red";
}

const WEIGHTS = [
  { key: "sales", label: "Savdo KPI", icon: "🪙", color: "var(--c-primary)" },
  { key: "margin", label: "Marja KPI", icon: "📈", color: "var(--c-info)" },
  { key: "attendance", label: "Davomat KPI", icon: "🕐", color: "var(--c-accent)" },
  { key: "discipline", label: "Intizom KPI", icon: "🛡️", color: "var(--c-purple)" },
  { key: "customer", label: "Mijoz KPI", icon: "⭐", color: "var(--c-danger)" },
] as const;

export default async function KpiPage() {
  const d = await getKpiData();

  return (
    <div>
      <PageHeader
        title="KPI tizimi — xodimlar baholash"
        subtitle={`${monthName(d.month)} ${d.year} — 100 ballik tizim`}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="O'rtacha KPI (filial)" value={`${d.avg}%`} valueColor="var(--c-primary)" />
        <MetricCard label="Jami bonus fondi" value={formatNumber(d.bonusFund)} sub="Joriy oy" />
        <MetricCard
          label="90%+ xodimlar"
          value={`${d.over90}/${d.ranking.length}`}
          valueColor="var(--c-primary)"
          sub="Maksimal bonus"
        />
        <MetricCard label="60% dan past" value={String(d.under60)} valueColor="var(--c-danger)" sub="Bonus yo'q" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Card title={`Reyting — ${monthName(d.month)} ${d.year}`} icon="🏆">
            <div className="flex flex-col gap-1.5">
              {d.ranking.map((r, i) => (
                <div key={r.id} className="flex items-center gap-3 rounded-lg border border-edge p-2.5">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium"
                    style={{
                      background: RANK_BG[i] ?? "var(--c-surface)",
                      color: RANK_FG[i] ?? "var(--c-muted)",
                    }}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{r.name}</div>
                    <div className="text-xs text-muted">{r.position}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold" style={{ color: scoreColor(r.total) }}>
                      {r.total}
                    </div>
                  </div>
                  <Badge color={bonusBadge(r.bonusPercent)}>+{r.bonusPercent}% bonus</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card title="KPI tarkibi" icon="🥧">
            <p className="mb-3 text-xs text-muted">Har bir komponent og'irligi</p>
            <div className="flex flex-col gap-2.5">
              {WEIGHTS.map((w) => {
                const pct = Math.round(KPI_WEIGHTS[w.key] * 100);
                return (
                  <div key={w.key}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>
                        {w.icon} {w.label}
                      </span>
                      <span className="font-medium" style={{ color: w.color }}>
                        {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded bg-surface">
                      <div className="h-full rounded" style={{ width: `${pct}%`, background: w.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {d.top && (
          <Card
            title={`${d.top.name} — profil`}
            icon="✅"
            action={<Badge color="green">Top xodim</Badge>}
          >
            <div className="py-3 text-center">
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-lg font-semibold text-primary">
                {d.top.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
              </div>
              <div className="text-sm font-medium">{d.top.name}</div>
              <div className="text-xs text-muted">{d.top.position}</div>
              <div className="mt-3 text-3xl font-semibold text-primary">{d.top.total}</div>
              <div className="text-xs text-muted">KPI bali</div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  ["Savdo", d.top.components.sales, "var(--c-primary)"],
                  ["Marja", d.top.components.margin, "var(--c-info)"],
                  ["Davomat", d.top.components.attendance, "var(--c-accent)"],
                  ["Intizom", d.top.components.discipline, "var(--c-purple)"],
                ] as const
              ).map(([label, val, color]) => (
                <div key={label} className="rounded-lg border border-edge p-2">
                  <div className="text-[10px] text-muted">{label}</div>
                  <div className="text-sm font-semibold" style={{ color }}>
                    {val}%
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded bg-surface">
                    <div className="h-full rounded" style={{ width: `${val}%`, background: color }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-edge bg-gradient-to-br from-primary-light to-info-light p-4">
              <div className="mb-2 text-xs text-muted">Bonus hisob-kitobi</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-base font-semibold">{formatNumber(d.top.baseSalary)}</div>
                  <div className="text-[11px] text-muted">Base maosh</div>
                </div>
                <div>
                  <div className="text-base font-semibold text-primary">{d.top.bonusPercent}%</div>
                  <div className="text-[11px] text-muted">Bonus foiz</div>
                </div>
                <div>
                  <div className="text-base font-semibold text-primary">{formatNumber(d.top.bonusAmount)}</div>
                  <div className="text-[11px] text-muted">Bonus miqdori</div>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
