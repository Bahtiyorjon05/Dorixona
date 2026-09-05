import { getExpensesData, getFinanceData } from "@/lib/queries";
import { formatNumber, formatSom, monthName } from "@/lib/format";
import { Badge, Card, MetricCard, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  RENT: "Ijara",
  UTILITIES: "Kommunal",
  GOODS: "Tovar",
  SALARY: "Oylik",
  LICENSE: "Soliq / litsenziya",
  OTHER: "Boshqa",
};

function Bars({
  data,
  tone = "primary",
}: {
  data: { label: string; value: number; sub?: string }[];
  tone?: "primary" | "danger";
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-3">
      {data.length === 0 && <p className="text-sm text-muted">Ma&apos;lumot yo&apos;q.</p>}
      {data.map((d) => (
        <div key={d.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span>
              {d.label}
              {d.sub && <span className="text-muted"> {d.sub}</span>}
            </span>
            <span className="text-muted">{formatSom(d.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface">
            <div
              className={`h-full rounded-full ${tone === "danger" ? "bg-danger" : "bg-primary"}`}
              style={{ width: `${Math.max(3, (d.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default async function MoliyaPage() {
  const [d, ex] = await Promise.all([getFinanceData(), getExpensesData()]);

  const units = ex.monthlyUnits;
  const totalTurnover = units.reduce((s, u) => s + u.turnover, 0);
  const totalProfit = units.reduce((s, u) => s + u.profit, 0);
  const net = totalProfit - ex.total;
  const period = `${ex.period.getFullYear()}-yil ${monthName(ex.period.getMonth() + 1)}`;
  const hasPos = d.cashTotal > 0 || d.todaySales > 0;

  const catBars = ex.byCategory.map((c) => ({
    label: CATEGORY_LABEL[c.category] ?? c.category,
    value: c.amount,
  }));
  const unitBars = ex.byUnit.map((u) => ({
    label: u.unit,
    value: u.amount,
    sub: `(${u.count} ta)`,
  }));

  return (
    <div>
      <PageHeader title="Moliyaviy statistika" subtitle={`${period} — umumiy holat`} />

      {/* Asosiy ko'rsatkichlar */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard icon="🪙" label="Jami savdo" value={formatNumber(totalTurnover)} sub={period} />
        <MetricCard icon="📈" label="Jami foyda" value={formatNumber(totalProfit)} sub="Harajatlardan oldin" />
        <MetricCard
          icon="🧾"
          label="Jami harajat"
          value={formatNumber(ex.total)}
          valueColor="var(--c-danger)"
          sub={`${ex.list.length} ta yozuv`}
        />
        <MetricCard
          icon="🏦"
          label="Sof foyda"
          value={formatNumber(net)}
          valueColor={net >= 0 ? "var(--c-success)" : "var(--c-danger)"}
          sub="Foyda − harajat"
        />
      </div>

      {/* Dorixonalar kesimi */}
      {units.length > 0 && (
        <Card title={`${period} — dorixonalar kesimi`} icon="🏪" className="mb-5">
          <div className="grid gap-4 lg:grid-cols-3">
            {units.map((u) => (
              <div key={u.unit} className="rounded-lg border border-surface p-3">
                <div className="mb-2 font-medium">{u.unit}</div>
                <dl className="space-y-1.5 text-sm">
                  {u.turnover > 0 && <Row label="Savdo" value={formatSom(u.turnover)} />}
                  {u.profit > 0 && <Row label="Foyda" value={formatSom(u.profit)} />}
                  <Row label="Harajat" value={`−${formatSom(u.expenses)}`} />
                  {u.profit > 0 && (
                    <div className="flex justify-between border-t border-surface pt-1.5 font-medium">
                      <dt>Sof foyda</dt>
                      <dd style={{ color: u.netProfit >= 0 ? "var(--c-success)" : "var(--c-danger)" }}>
                        {formatSom(u.netProfit)}
                      </dd>
                    </div>
                  )}
                  {u.stockValue > 0 && <Row label="Qoldiq (astatka)" value={formatSom(u.stockValue)} />}
                  {u.revaluation > 0 && <Row label="Qayta baholash" value={formatSom(u.revaluation)} />}
                  {u.bankBalance !== null && <Row label="Bank" value={formatSom(u.bankBalance)} />}
                </dl>
                {u.note && <p className="mt-2 text-xs text-muted">{u.note}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Harajat statistikasi — harajatlar sahifasidan sinxron */}
      <div className="mb-5 grid gap-3 lg:grid-cols-2">
        <Card title="Harajat toifalari" icon="📊">
          <Bars data={catBars} tone="danger" />
          <div className="mt-4 flex justify-between border-t border-surface pt-3 text-sm font-medium">
            <span>Jami</span>
            <span>{formatSom(ex.total)}</span>
          </div>
        </Card>
        <Card title="Dorixonalar bo'yicha harajat" icon="🏪">
          <Bars data={unitBars} />
          <div className="mt-4 flex justify-between border-t border-surface pt-3 text-sm font-medium">
            <span>Eng ko&apos;p</span>
            <span>{unitBars[0]?.label ?? "—"}</span>
          </div>
        </Card>
      </div>

      {/* Ombor va kassa */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard icon="📦" label="Ombor qiymati" value={formatNumber(d.inventoryValue)} sub="Sotuv narxida" />
        <MetricCard icon="🛒" label="Kunlik savdo (kassa)" value={formatNumber(d.todaySales)} sub="Bugun, POS orqali" />
        <MetricCard
          icon="👛"
          label="Oylik tushum (kassa)"
          value={formatNumber(d.cashTotal)}
          sub={`Naqd: ${formatNumber(d.cash)} · Terminal: ${formatNumber(d.card)}`}
        />
        <MetricCard icon="💹" label="Oylik marja (kassa)" value={formatNumber(d.monthlyProfit)} sub="POS savdolaridan" />
      </div>

      {/* Qarzlar */}
      {ex.debts.length > 0 && (
        <Card title="Qarzlar" icon="🧮" className="mb-5">
          <div className="space-y-3">
            {ex.debts.map((q) => (
              <div key={q.id} className="border-b border-surface pb-3 last:border-0 last:pb-0">
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{q.counterparty}</span>
                  <Badge color={q.direction === "PAYABLE" ? "red" : "green"}>
                    {q.direction === "PAYABLE" ? "To'lashimiz kerak" : "Olishimiz kerak"}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Qoldiq</span>
                  <span>{formatSom(q.remaining)}</span>
                </div>
                {q.paid > 0 && (
                  <div className="flex justify-between text-xs text-muted">
                    <span>To&apos;langan</span>
                    <span>
                      {formatSom(q.paid)} / {formatSom(q.total)}
                    </span>
                  </div>
                )}
                {q.note && <p className="mt-1 text-xs text-muted">{q.note}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {!hasPos && (
        <p className="mb-5 text-xs text-muted">
          Kassada (POS) hali savdo qayd etilmagan — quyidagi grafiklar shu sababli bo&apos;sh. Yuqoridagi savdo va
          foyda raqamlari oylik hisobotdan olingan.
        </p>
      )}

      <Card title="6 oylik savdo va harajat tahlili" icon="📈">
        <div className="space-y-2">
          {d.profitSeries.map((month) => (
            <div key={month.label} className="grid grid-cols-[48px_1fr] items-center gap-3 text-xs">
              <span className="text-muted">{month.label}</span>
              <div className="grid gap-1">
                <div className="flex items-center gap-2">
                  <span className="w-14 text-muted">Savdo</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, month.savdo * 12)}%` }} />
                  </div>
                  <span className="w-14 text-right text-muted">{month.savdo}M</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-14 text-muted">Harajat</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                    <div className="h-full rounded-full bg-danger" style={{ width: `${Math.min(100, month.xarajat * 12)}%` }} />
                  </div>
                  <span className="w-14 text-right text-muted">{month.xarajat}M</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
