import { getAnalyticsData } from "@/lib/queries";
import { formatNumber } from "@/lib/format";
import { MetricCard, PageHeader } from "@/components/ui";
import { AnalitikaView } from "@/components/AnalitikaView";

export const dynamic = "force-dynamic";

function parseYear(raw: string | string[] | undefined): number | undefined {
  const v = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(v) && v >= 2000 && v <= 2100 ? v : undefined;
}

export default async function AnalitikaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const year = parseYear((await searchParams).yil);
  const d = await getAnalyticsData(year);

  const oxirgi = d.monthly.at(-1);
  const jamiSavdo = d.monthly.reduce((s, m) => s + m.savdo, 0);
  const jamiFoyda = d.monthly.reduce((s, m) => s + m.foyda, 0);

  return (
    <div>
      <PageHeader title="Analitika" subtitle={`${d.year}-yil tahlili — savdo, foyda, ombor`} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label={`${d.year} jami savdo`} value={`${formatNumber(jamiSavdo)} mln`} />
        <MetricCard
          label={`${d.year} jami foyda`}
          value={`${formatNumber(jamiFoyda)} mln`}
          valueColor="var(--c-primary)"
        />
        <MetricCard
          label="Ombor qiymati (hozir)"
          value={`${formatNumber(d.inventoryTotal)} mln`}
          sub="Chakana narxda"
        />
        <MetricCard
          label="Oxirgi oy savdo"
          value={oxirgi ? `${formatNumber(oxirgi.savdo)} mln` : "—"}
          sub={d.lastMonthName ?? undefined}
        />
      </div>

      <AnalitikaView
        year={d.year}
        monthly={d.monthly}
        byUnit={d.byUnit}
        lastMonthName={d.lastMonthName}
        inventoryByCategory={d.inventoryByCategory}
        inventoryTotal={d.inventoryTotal}
        assortment={d.assortment}
        topProducts={d.topProducts}
        slowMovers={d.slowMovers}
        turnoverRatio={d.turnoverRatio}
        vedomost={d.vedomost}
        dailySales={d.dailySales}
      />

      {!d.hasFinance && !d.hasInventory && (
        <p className="mt-4 rounded-lg border border-dashed border-edge p-4 text-center text-sm text-muted">
          Hali ma&apos;lumot yig&apos;ilmagan. Oylik moliya kiritilgach va F-Apteka qoldig&apos;i
          kelgach, grafiklar avtomatik to&apos;ladi.
        </p>
      )}
    </div>
  );
}
