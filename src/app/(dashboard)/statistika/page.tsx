import { getStatsData } from "@/lib/queries";
import { formatCompact, formatSom, monthName } from "@/lib/format";
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

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface">
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${Math.max(3, (value / Math.max(max, 1)) * 100)}%` }}
      />
    </div>
  );
}

export default async function StatistikaPage() {
  const d = await getStatsData();
  const p = d.period;
  const maxCat = Math.max(...d.categories.map((c) => c.amount), 1);
  const realUnits = d.units.filter((u) => u.turnover > 0 || u.expenses > 0);

  return (
    <div>
      <PageHeader
        title="Statistika"
        subtitle={`${p.getFullYear()}-yil, ${monthName(p.getMonth() + 1)} oyi bo'yicha moliyaviy xulosa`}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard icon="💰" label="Savdo" value={formatCompact(d.totals.turnover)} sub="jami aylanma" />
        <MetricCard icon="📈" label="Foyda" value={formatCompact(d.totals.profit)} sub="xarajatlardan oldin" />
        <MetricCard icon="🧾" label="Xarajat" value={formatCompact(d.totals.expenses)} sub={`${d.units.reduce((s, u) => s + u.expenseCount, 0)} ta yozuv`} />
        <MetricCard
          icon="🏦"
          label="Sof foyda"
          value={formatCompact(d.totals.netProfit)}
          valueColor={d.totals.netProfit >= 0 ? "green" : "red"}
          sub="foyda − xarajat"
        />
      </div>

      <div className="mb-5 grid gap-3 lg:grid-cols-2">
        {realUnits.map((u) => (
          <Card key={u.name} title={u.name} icon="🏪">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Savdo</dt>
                <dd>{formatSom(u.turnover)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Foyda</dt>
                <dd>{formatSom(u.profit)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Xarajat ({u.expenseCount} ta)</dt>
                <dd>−{formatSom(u.expenses)}</dd>
              </div>
              <div className="flex justify-between border-t border-surface pt-2 font-medium">
                <dt>Sof foyda</dt>
                <dd className={u.netProfit >= 0 ? "text-green-600" : "text-red-600"}>
                  {formatSom(u.netProfit)}
                </dd>
              </div>
              {u.stockValue > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted">Qoldiq (astatka)</dt>
                  <dd>{formatSom(u.stockValue)}</dd>
                </div>
              )}
              {u.revaluation > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted">Qayta baholash</dt>
                  <dd>{formatSom(u.revaluation)}</dd>
                </div>
              )}
              {u.bankBalance !== null && (
                <div className="flex justify-between">
                  <dt className="text-muted">Bank</dt>
                  <dd>{formatSom(u.bankBalance)}</dd>
                </div>
              )}
            </dl>
            {u.note && <p className="mt-3 text-xs text-muted">{u.note}</p>}
          </Card>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Xarajat toifalari" icon="📊">
          {d.categories.length ? (
            <div className="space-y-3">
              {d.categories.map((c) => (
                <div key={c.category}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span>{CATEGORY_LABEL[c.category] ?? c.category}</span>
                    <span className="text-muted">{formatSom(c.amount)}</span>
                  </div>
                  <Bar value={c.amount} max={maxCat} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Bu oyda xarajat yo&apos;q.</p>
          )}
        </Card>

        <Card title="Qarzlar" icon="🧮">
          {d.debts.length ? (
            <div className="space-y-3">
              {d.debts.map((q) => (
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
          ) : (
            <p className="text-sm text-muted">Qarzlar yo&apos;q.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
