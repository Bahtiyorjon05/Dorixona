import { getDebtsData, getExpensesData, getFinanceData } from "@/lib/queries";
import { formatNumber, monthName } from "@/lib/format";
import { Card, MetricCard, PageHeader, TrendDown, TrendUp } from "@/components/ui";
import { FoydaXarajatChart, SavdoChart, ToifalarChart } from "@/components/charts/FinanceCharts";
import { currentFilial } from "@/lib/filial-server";
import { MonthPicker } from "@/components/MonthPicker";

export const dynamic = "force-dynamic";


function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function parseMonth(raw: string | string[] | undefined): Date | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const m = /^(\d{4})-(\d{1,2})$/.exec(value ?? "");
  if (!m) return undefined;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return undefined;
  return new Date(Number(m[1]), month - 1, 1);
}

export default async function MoliyaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const selected = parseMonth((await searchParams).oy);
  const [d, ex, filial, debts] = await Promise.all([
    getFinanceData(selected),
    getExpensesData(selected),
    currentFilial(),
    getDebtsData(),
  ]);

  const period = `${ex.period.getFullYear()}-yil ${monthName(ex.period.getMonth() + 1)}`;


  return (
    <div>
      <PageHeader
        title="Moliyaviy ko'rsatkichlar"
        subtitle={`${period}${filial === "Umumiy" ? "" : ` — ${filial} filiali`}`}
        action={
          <MonthPicker
            current={`${ex.period.getFullYear()}-${ex.period.getMonth() + 1}`}
            available={ex.availableMonths.map((m: Date) => `${m.getFullYear()}-${m.getMonth() + 1}`)}
            basePath="/moliya"
          />
        }
      />

      {/* Qarz eslatmasi — muddati o'tgan va yaqinlari */}
      {(debts.overdue.length > 0 || debts.dueSoon.length > 0) && (
        <a
          href="/qarzlar"
          className={`mb-5 block rounded-lg border p-3 text-sm ${
            debts.overdue.length > 0
              ? "border-danger bg-danger-light"
              : "border-edge bg-accent-light"
          }`}
        >
          {debts.overdue.length > 0 && (
            <div>
              🔴 <b>Muddati o&apos;tgan {debts.overdue.length} ta qarz</b> —{" "}
              {debts.overdue.map((debt) => debt.counterparty).join(", ")}
            </div>
          )}
          {debts.dueSoon.length > 0 && (
            <div className={debts.overdue.length > 0 ? "mt-1" : undefined}>
              🟡 Muddati yaqin {debts.dueSoon.length} ta qarz —{" "}
              {debts.dueSoon.map((debt) => debt.counterparty).join(", ")}
            </div>
          )}
        </a>
      )}

      {/* Kassa ko'rsatkichlari */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
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
        <MetricCard label="Oylik foyda (marja)" value={formatNumber(d.monthlyProfit)} sub="POS savdolaridan" />
        <MetricCard
          label="Kassadagi pul"
          value={formatNumber(d.cashTotal)}
          sub={`Naqd: ${formatNumber(d.cash)} · Terminal: ${formatNumber(d.card)}`}
        />
        <MetricCard label="Ombor qiymati" value={formatNumber(d.inventoryValue)} sub="Tan narxida" />
      </div>

      {/* Grafiklar */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Savdo dinamikasi" icon="📊">
          <SavdoChart week={d.weekSales} month={d.monthDaily} sixMonth={d.sixMonthSales} />
        </Card>
        <Card title="Toifalar ulushi" icon="🍩">
          <ToifalarChart data={d.categories} />
        </Card>
      </div>

      <Card title="6 oylik savdo va harajat tahlili" icon="📈" className="mb-5">
        <FoydaXarajatChart data={d.profitSeries} />
      </Card>

      <p className="text-xs text-muted">
        Harajat, dorixonalar kesimi va qarzlar — <a href="/harajatlar" className="text-primary">Harajatlar</a> va{" "}
        <a href="/qarzlar" className="text-primary">Qarzlar</a> bo&apos;limlarida.
      </p>
    </div>
  );
}
