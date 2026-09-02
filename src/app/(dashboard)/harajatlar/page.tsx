import { getExpensesData } from "@/lib/queries";
import { formatNumber, formatSom, monthName } from "@/lib/format";
import { Badge, Card, MetricCard, PageHeader } from "@/components/ui";
import { ExpensesPanel } from "@/components/panels/ExpensesPanel";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  RENT: "Ijara",
  UTILITIES: "Kommunal",
  GOODS: "Tovar",
  SALARY: "Oylik",
  LICENSE: "Soliq / litsenziya",
  OTHER: "Boshqa",
};

function Row({ label, value, muted = true }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className={muted ? "text-muted" : ""}>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default async function HarajatlarPage() {
  const d = await getExpensesData();
  const now = new Date();
  const isPast =
    d.period.getFullYear() !== now.getFullYear() || d.period.getMonth() !== now.getMonth();
  const label = `${d.period.getFullYear()}-yil ${monthName(d.period.getMonth() + 1)}`;

  const maxCat = Math.max(...d.byCategory.map((c) => c.amount), 1);
  const maxUnit = Math.max(...d.byUnit.map((u) => u.amount), 1);
  const totalTurnover = d.monthlyUnits.reduce((s, u) => s + u.turnover, 0);
  const totalProfit = d.monthlyUnits.reduce((s, u) => s + u.profit, 0);

  return (
    <div>
      <PageHeader
        title="Harajatlar boshqaruvi"
        subtitle={`${label} — moliyaviy xulosa va xarajatlar`}
        action={isPast ? <Badge color="amber">{label} ma&apos;lumotlari</Badge> : undefined}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Jami harajat" value={formatNumber(d.total)} valueColor="var(--c-danger)" sub={`${d.list.length} ta yozuv`} />
        <MetricCard label="Ijara va kommunal" value={formatNumber(d.rent)} sub="Doimiy xarajat" />
        <MetricCard label="Maosh fondi" value={formatNumber(d.salary)} sub="Xodimlar" />
        {totalProfit > 0 ? (
          <MetricCard
            label="Sof foyda"
            value={formatNumber(totalProfit - d.total)}
            valueColor={totalProfit - d.total >= 0 ? "var(--c-success)" : "var(--c-danger)"}
            sub="Foyda − harajat"
          />
        ) : (
          <MetricCard label="Sotib olishlar" value={formatNumber(d.goods)} sub="Tovar" />
        )}
      </div>

      {d.monthlyUnits.length > 0 && (
        <Card title={`${label} — dorixonalar kesimi`} icon="🏪" className="mb-5">
          <div className="grid gap-4 lg:grid-cols-3">
            {d.monthlyUnits.map((u) => (
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
          {totalTurnover > 0 && (
            <div className="mt-4 flex justify-between border-t border-surface pt-3 text-sm font-medium">
              <span>Jami savdo</span>
              <span>{formatSom(totalTurnover)}</span>
            </div>
          )}
        </Card>
      )}

      <div className="mb-5 grid gap-3 lg:grid-cols-2">
        <Card title="Dorixonalar bo'yicha harajat" icon="🏪">
          <div className="space-y-3">
            {d.byUnit.map((u) => (
              <div key={u.unit}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>
                    {u.unit} <span className="text-muted">({u.count} ta)</span>
                  </span>
                  <span className="text-muted">{formatSom(u.amount)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, (u.amount / maxUnit) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Toifalar bo'yicha" icon="📊">
          <div className="space-y-3">
            {d.byCategory.map((c) => (
              <div key={c.category}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{CATEGORY_LABEL[c.category] ?? c.category}</span>
                  <span className="text-muted">{formatSom(c.amount)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface">
                  <div className="h-full rounded-full bg-danger" style={{ width: `${Math.max(3, (c.amount / maxCat) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {d.debts.length > 0 && (
        <Card title="Qarzlar" icon="🧮" className="mb-5">
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
        </Card>
      )}

      <ExpensesPanel
        list={d.list.map((e) => ({
          id: e.id,
          title: e.unit ? `${e.title} · ${e.unit}` : e.title,
          category: e.category,
          amount: e.amount,
          spentAt: e.spentAt.toISOString(),
          isRecurring: e.isRecurring,
        }))}
      />
    </div>
  );
}
