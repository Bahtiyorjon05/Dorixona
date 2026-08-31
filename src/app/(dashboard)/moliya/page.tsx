import { getFinanceData } from "@/lib/queries";
import { formatNumber, formatSom, monthName } from "@/lib/format";
import { Badge, Card, MetricCard, PageHeader, TrendDown, TrendUp } from "@/components/ui";

export const dynamic = "force-dynamic";

function ServerBars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((item) => item.value), 0.01);
  return (
    <div className="space-y-2">
      {data.map((item) => (
        <div key={item.label} className="grid grid-cols-[48px_1fr_64px] items-center gap-2 text-xs">
          <span className="text-muted">{item.label}</span>
          <div className="h-3 overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }}
            />
          </div>
          <span className="text-right text-muted">{item.value.toFixed(1)}M</span>
        </div>
      ))}
    </div>
  );
}

function CategoryList({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div className="space-y-2">
      {data.length ? data.map((item) => (
        <div key={item.name} className="grid grid-cols-[1fr_44px] items-center gap-2 text-sm">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span>{item.name}</span>
              <span className="text-muted">{item.value}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface">
              <div className="h-full rounded-full bg-primary" style={{ width: `${item.value}%` }} />
            </div>
          </div>
        </div>
      )) : <p className="text-sm text-muted">Savdo toifalari hali yo'q.</p>}
    </div>
  );
}

export default async function MoliyaPage() {
  const d = await getFinanceData();
  const now = new Date();

  return (
    <div>
      <PageHeader
        title="Moliyaviy ko'rsatkichlar"
        subtitle={`${now.getFullYear()}-yil, ${monthName(now.getMonth() + 1)} oyidagi holat`}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          icon="🪙"
          label="Kunlik savdo"
          value={formatNumber(d.todaySales)}
          sub={
            <>
              {d.todayTrend >= 0 ? (
                <TrendUp>{Math.abs(d.todayTrend).toFixed(1)}%</TrendUp>
              ) : (
                <TrendDown>{Math.abs(d.todayTrend).toFixed(1)}%</TrendDown>
              )}{" "}
              kechadan
            </>
          }
        />
        <MetricCard
          icon="📈"
          label="Oylik foyda (marja)"
          value={formatNumber(d.monthlyProfit)}
          sub={
            <>
              {d.profitTrend >= 0 ? (
                <TrendUp>{Math.abs(d.profitTrend).toFixed(1)}%</TrendUp>
              ) : (
                <TrendDown>{Math.abs(d.profitTrend).toFixed(1)}%</TrendDown>
              )}{" "}
              o'tgan oydan
            </>
          }
        />
        <MetricCard
          icon="👛"
          label="Oylik tushum"
          value={formatNumber(d.cashTotal)}
          sub={`Naqd: ${formatNumber(d.cash)} · Terminal: ${formatNumber(d.card)}`}
        />
        <MetricCard
          icon="📦"
          label="Ombor qiymati"
          value={formatNumber(d.inventoryValue)}
          sub="Tan narxida"
        />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Savdo dinamikasi (7 kun)" icon="📊">
          <ServerBars data={d.weekSales} />
        </Card>
        <Card title="Toifalar ulushi (oy)" icon="🍩">
          <CategoryList data={d.categories} />
        </Card>
      </div>

      <Card title="6 oylik savdo va xarajat tahlili" icon="📈">
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
                  <span className="w-14 text-muted">Xarajat</span>
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

      {d.monthlyPeriod && d.monthlyUnits.length > 0 && (
        <Card
          title={`${d.monthlyPeriod.getFullYear()}-yil ${monthName(d.monthlyPeriod.getMonth() + 1)} — dorixonalar kesimi`}
          icon="🏪"
          className="mt-5"
        >
          <div className="grid gap-4 lg:grid-cols-2">
            {d.monthlyUnits.map((u) => (
              <div key={u.unit} className="rounded-lg border border-surface p-3">
                <div className="mb-2 font-medium">{u.unit}</div>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><dt className="text-muted">Savdo</dt><dd>{formatSom(u.turnover)}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted">Foyda</dt><dd>{formatSom(u.profit)}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted">Xarajat</dt><dd>−{formatSom(u.expenses)}</dd></div>
                  <div className="flex justify-between border-t border-surface pt-1.5 font-medium">
                    <dt>Sof foyda</dt>
                    <dd style={{ color: u.netProfit >= 0 ? "var(--c-success)" : "var(--c-danger)" }}>
                      {formatSom(u.netProfit)}
                    </dd>
                  </div>
                  {u.stockValue > 0 && (
                    <div className="flex justify-between"><dt className="text-muted">Qoldiq</dt><dd>{formatSom(u.stockValue)}</dd></div>
                  )}
                  {u.revaluation > 0 && (
                    <div className="flex justify-between"><dt className="text-muted">Qayta baholash</dt><dd>{formatSom(u.revaluation)}</dd></div>
                  )}
                  {u.bankBalance !== null && (
                    <div className="flex justify-between"><dt className="text-muted">Bank</dt><dd>{formatSom(u.bankBalance)}</dd></div>
                  )}
                </dl>
                {u.note && <p className="mt-2 text-xs text-muted">{u.note}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {d.debts.length > 0 && (
        <Card title="Qarzlar" icon="🧮" className="mt-5">
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
                    <span>{formatSom(q.paid)} / {formatSom(q.total)}</span>
                  </div>
                )}
                {q.note && <p className="mt-1 text-xs text-muted">{q.note}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
