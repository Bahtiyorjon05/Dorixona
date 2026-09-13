import { getAnalyticsData } from "@/lib/queries";
import { formatNumber } from "@/lib/format";
import { Card, MetricCard, PageHeader } from "@/components/ui";
import {
  AstatkaChart,
  DinamikaChart,
  FiliallarChart,
  OmborToifaChart,
} from "@/components/charts/AnalyticsCharts";

export const dynamic = "force-dynamic";

export default async function AnalitikaPage() {
  const d = await getAnalyticsData();

  const oxirgi = d.monthly.at(-1);
  const jamiSavdo = d.monthly.reduce((s, m) => s + m.savdo, 0);
  const jamiFoyda = d.monthly.reduce((s, m) => s + m.foyda, 0);

  return (
    <div>
      <PageHeader title="Analitika" subtitle={`${d.year}-yil tahlili — savdo, foyda, ombor`} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          icon="🪙"
          label={`${d.year} jami savdo`}
          value={`${formatNumber(jamiSavdo)} mln`}
        />
        <MetricCard
          icon="📈"
          label={`${d.year} jami foyda`}
          value={`${formatNumber(jamiFoyda)} mln`}
          valueColor="var(--c-primary)"
        />
        <MetricCard
          icon="📦"
          label="Ombor qiymati (hozir)"
          value={`${formatNumber(d.inventoryTotal)} mln`}
          sub="Chakana narxda"
        />
        <MetricCard
          icon="🗓️"
          label="Oxirgi oy savdo"
          value={oxirgi ? `${formatNumber(oxirgi.savdo)} mln` : "—"}
          sub={d.lastMonthName ?? undefined}
        />
      </div>

      <Card title="Savdo va foyda dinamikasi" icon="📈" className="mb-4">
        <p className="mb-3 text-sm text-muted">
          {d.year}-yil oylik ko'rsatkichlar (mln so'm)
        </p>
        <DinamikaChart data={d.monthly} />
      </Card>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Astatka dinamikasi" icon="📊">
          <AstatkaChart data={d.monthly} />
        </Card>
        <Card
          title={`Dorixonalar taqqoslashi${d.lastMonthName ? ` — ${d.lastMonthName}` : ""}`}
          icon="🏪"
        >
          <FiliallarChart data={d.byUnit} />
        </Card>
      </div>

      <Card title="Ombor qiymati — toifalar bo'yicha" icon="💊">
        <p className="mb-3 text-sm text-muted">
          Hozirgi qoldiq chakana narxda, jami {formatNumber(d.inventoryTotal)} mln so'm
        </p>
        <OmborToifaChart data={d.inventoryByCategory} />
      </Card>

      {!d.hasFinance && !d.hasInventory && (
        <p className="mt-4 rounded-lg border border-dashed border-edge p-4 text-center text-sm text-muted">
          Hali ma'lumot yig'ilmagan. Oylik moliya kiritilgach va F-Apteka qoldig'i
          kelgach, grafiklar avtomatik to'ladi.
        </p>
      )}
    </div>
  );
}
