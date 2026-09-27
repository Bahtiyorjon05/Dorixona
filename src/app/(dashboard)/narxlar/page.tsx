import { Card, MetricCard, PageHeader } from "@/components/ui";
import { PricePanel } from "@/components/panels/PricePanel";
import { formatDate, formatNumber, formatTime } from "@/lib/format";
import { getPriceWatchData } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function NarxlarPage() {
  const d = await getPriceWatchData();

  return (
    <div>
      <PageHeader
        title="Narx nazorati"
        subtitle="Toshkentdagi eng arzon narx + ustama — talabchan dorilar bo'yicha"
      />

      {d.needsMigration && (
        <div className="mb-5 rounded-lg border border-danger bg-danger-light p-3 text-sm">
          <b>Jadval hali yaratilmagan.</b> Supabase → SQL Editor da avval{" "}
          <code>prisma/manual/narx-nazorati.sql</code>, so&apos;ng{" "}
          <code>prisma/manual/narx-royxati.sql</code> ni ishga tushiring.
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          icon="💊"
          label="Kuzatilayotgan dori"
          value={formatNumber(d.total)}
          sub={`${d.linked} tasi ombor bilan bog'langan`}
        />
        <MetricCard
          icon="🔻"
          label="Raqobatchi narxi bor"
          value={formatNumber(d.priced)}
          sub="Solishtirish mumkin"
        />
        <MetricCard
          icon="⚠️"
          label="Biznikidan qimmat"
          value={formatNumber(d.overpriced)}
          valueColor={d.overpriced > 0 ? "var(--c-danger)" : undefined}
          sub="Narxni tushirish kerak"
        />
        <MetricCard
          icon="🕐"
          label="Oxirgi tekshiruv"
          value={d.lastChecked ? formatTime(d.lastChecked) : "—"}
          sub={d.lastChecked ? formatDate(d.lastChecked) : "hali tekshirilmagan"}
        />
      </div>

      <Card title="Dorilar ro'yxati" icon="💹">
        <PricePanel items={d.items} settings={d.settings} percent={d.percent} />
      </Card>

      <p className="mt-4 text-xs text-muted">
        Narxlar arzonapteka.uz dagi ochiq sahifalardan olinadi — o&apos;sha yerda Toshkent bo&apos;yicha
        eng arzon taklif ko&apos;rsatiladi. Ro&apos;yxat har uch soatda o&apos;zi yangilanadi.
        Tavsiya narxni F-Apteka&apos;da qo&apos;lda qo&apos;yasiz: F-Apteka tashqaridan narx yozishga
        ruxsat bermaydi.
      </p>
    </div>
  );
}
