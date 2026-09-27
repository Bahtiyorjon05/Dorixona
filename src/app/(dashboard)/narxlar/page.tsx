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
        subtitle="Kam sotilayotgan dorilarga Toshkentdagi eng arzon narx + ustama"
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
          icon="🐌"
          label="Kam sotilayotgan"
          value={formatNumber(d.slowCount)}
          sub="Ustama shularga qo'llanadi"
        />
        <MetricCard
          icon="🔥"
          label="Topiviy dorilar"
          value={formatNumber(d.topCount)}
          sub={`Oyiga ${d.topPerMonth} donadan ko'p`}
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
        <PricePanel
          items={d.items}
          settings={d.settings}
          percent={d.percent}
          salesDays={d.salesDays}
          topPerMonth={d.topPerMonth}
        />
      </Card>

      <div className="mt-4 space-y-1.5 text-xs text-muted">
        <p>
          Dorilar savdo ma&apos;lumotiga qarab ikkiga bo&apos;linadi: oxirgi {d.salesDays} kunda
          oyiga {d.topPerMonth} donadan ko&apos;p sotilgani <b>topiviy</b>, qolgani{" "}
          <b>kam sotilayotgan</b>. Avtomatik ustama kam sotilayotganlarga kerak — ular turib
          qolmasin deb raqobatchining eng arzon narxiga yaqin qo&apos;yiladi.
          {d.unmatchedCount > 0 && (
            <>
              {" "}
              {formatNumber(d.unmatchedCount)} ta dori ombor bilan bog&apos;lanmagan, savdosi
              ko&apos;rinmaydi — ular &laquo;Bog&apos;lanmagan&raquo; ro&apos;yxatida.
            </>
          )}
        </p>
        <p>
          Narxlar arzonapteka.uz dagi ochiq sahifalardan olinadi — o&apos;sha yerda Toshkent
          bo&apos;yicha eng arzon taklif ko&apos;rsatiladi. Ro&apos;yxat har uch soatda o&apos;zi
          yangilanadi. Tavsiya narxni F-Apteka&apos;da qo&apos;lda qo&apos;yasiz: F-Apteka
          tashqaridan narx yozishga ruxsat bermaydi.
        </p>
      </div>
    </div>
  );
}
