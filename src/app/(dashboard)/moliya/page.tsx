import { getFinanceData } from "@/lib/queries";
import { formatNumber, formatSom, monthName } from "@/lib/format";
import { Card, MetricCard, PageHeader, TrendDown, TrendUp } from "@/components/ui";
import { CategoryDonut, ProfitLineChart, SalesBarChart } from "@/components/charts";

export const dynamic = "force-dynamic";

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
          <SalesBarChart data={d.weekSales} />
        </Card>
        <Card title="Toifalar ulushi (oy)" icon="🍩">
          <CategoryDonut data={d.categories} />
        </Card>
      </div>

      <Card title="6 oylik savdo va xarajat tahlili" icon="📈">
        <ProfitLineChart data={d.profitSeries} />
      </Card>
    </div>
  );
}
