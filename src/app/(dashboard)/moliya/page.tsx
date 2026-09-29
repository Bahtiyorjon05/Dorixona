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
  const results = await Promise.allSettled([
    getFinanceData(selected),
    getExpensesData(selected),
    currentFilial(),
    getDebtsData(),
  ]);
  // Bitta so'rov yiqilsa butun sahifa (va login'dan keyingi yo'naltirish)
  // "Application error" bo'lib qolmasin — qaysi qism va nega yiqilgani chiqadi
  const failed = results
    .map((r, i) => ({ r, name: ["Moliya", "Harajatlar", "Filial", "Qarzlar"][i] }))
    .filter((x): x is { r: PromiseRejectedResult; name: string } => x.r.status === "rejected");
  if (failed.length) {
    for (const { name, r } of failed) console.error(`Moliya sahifasi — ${name}`, r.reason);
    return (
      <div className="card p-4 text-sm">
        <b className="text-danger">Moliya yuklanmadi.</b>
        {failed.map(({ name, r }) => (
          <pre key={name} className="mt-2 whitespace-pre-wrap text-xs text-muted">
            {name}: {r.reason instanceof Error ? `${r.reason.name}: ${r.reason.message}` : String(r.reason)}
          </pre>
        ))}
      </div>
    );
  }
  const [d, ex, filial, debts] = results.map((r) => (r as PromiseFulfilledResult<unknown>).value) as [
    Awaited<ReturnType<typeof getFinanceData>>,
    Awaited<ReturnType<typeof getExpensesData>>,
    Awaited<ReturnType<typeof currentFilial>>,
    Awaited<ReturnType<typeof getDebtsData>>,
  ];

  const period = `${ex.period.getFullYear()}-yil ${monthName(ex.period.getMonth() + 1)}`;
  // Tovar xaridisiz harajat (ijara, oylik, soliq, pereotsenka...) ayiriladi
  const netProfit = d.monthlyProfit - ex.total;


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
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <MetricCard
          icon="🧾"
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
        <MetricCard icon="📈" label="Oylik foyda" value={formatNumber(d.monthlyProfit)} sub="QQSsiz, F-Apteka bo'yicha" />
        <MetricCard
          icon="💰"
          label="Sof foyda"
          value={formatNumber(netProfit)}
          valueColor={netProfit >= 0 ? "var(--c-success)" : "var(--c-danger)"}
          sub={`Harajat: ${formatNumber(ex.total)}`}
        />
        <MetricCard
          icon="🏦"
          label="Oylik kassa tushumi"
          value={formatNumber(d.hasPayments ? d.paymentsTotal : d.cashTotal)}
          sub={
            d.hasPayments
              ? `Naqd: ${formatNumber(d.paymentsCash)} · Karta: ${formatNumber(d.paymentsCard)}`
              : d.hasFaptekaSplit
              ? `Qaytarilgan: ${formatNumber(d.faptekaRefunds)}`
              : `Naqd: ${formatNumber(d.cash)} · Terminal: ${formatNumber(d.card)}`
          }
        />
        <MetricCard icon="📦" label="Ombor qiymati" value={formatNumber(d.inventoryValue)} sub="Tan narxida" />
      </div>

      {d.hasPayments && (
        <Card title="To'lov turlari" icon="💳" className="mb-4">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tur</th>
                <th>Summa</th>
                <th>Ulushi</th>
              </tr>
            </thead>
            <tbody>
              {d.payments.map((payment) => (
                <tr key={payment.cashbox}>
                  <td className="text-left">{payment.label}</td>
                  <td>{formatNumber(payment.amount)}</td>
                  <td>
                    {d.paymentsTotal > 0
                      ? `${((payment.amount / d.paymentsTotal) * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                </tr>
              ))}
              <tr>
                <td className="text-left font-semibold">Jami</td>
                <td className="font-semibold">{formatNumber(d.paymentsTotal)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </Card>
      )}

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
    </div>
  );
}
