import { getFinanceData } from "@/lib/queries";
import { formatNumber, formatSom, monthName } from "@/lib/format";
import { Card, MetricCard, PageHeader, TrendDown, TrendUp } from "@/components/ui";

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
    </div>
  );
}
