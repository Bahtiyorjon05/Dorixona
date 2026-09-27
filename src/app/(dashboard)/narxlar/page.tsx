import { Card, MetricCard, PageHeader } from "@/components/ui";
import { PricePanel } from "@/components/panels/PricePanel";
import { formatDate, formatNumber, formatTime } from "@/lib/format";
import { getPriceWatchData, type PriceGroup } from "@/lib/queries";

export const dynamic = "force-dynamic";

function parseGroup(value?: string): PriceGroup | "all" {
  return value === "top" || value === "all" ? value : "slow";
}

export default async function NarxlarPage({
  searchParams,
}: {
  searchParams: Promise<{ guruh?: string; q?: string; sahifa?: string }>;
}) {
  const sp = await searchParams;
  const d = await getPriceWatchData({
    group: parseGroup(sp.guruh),
    search: sp.q,
    page: Number(sp.sahifa) || 1,
  });

  return (
    <div>
      <PageHeader title="Narx nazorati" />

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
        />
        <MetricCard
          icon="🔥"
          label="Topiviy dorilar"
          value={formatNumber(d.topCount)}
        />
        <MetricCard
          icon="⚠️"
          label="Tavsiyadan qimmat"
          value={formatNumber(d.overpriced)}
          valueColor={d.overpriced > 0 ? "var(--c-danger)" : undefined}
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
          group={d.group}
          search={d.search}
          page={d.page}
          pageSize={d.pageSize}
          total={d.total}
          topCount={d.topCount}
          slowCount={d.slowCount}
        />
      </Card>

      <div className="mt-4 space-y-1.5 text-xs text-muted">
        <p>
          Dorilar savdo ma&apos;lumotiga qarab ikkiga bo&apos;linadi: oxirgi {d.salesDays} kunda
          oyiga {d.topPerMonth} donadan ko&apos;p sotilgani <b>topiviy</b>, qolgani{" "}
          <b>kam sotilayotgan</b>.
        </p>
        <p>
          Tavsiya narx ikki xil hisoblanadi. arzonapteka.uz da kuzatiladigan{" "}
          {formatNumber(d.competitorCount)} ta doriga — <b>Toshkentdagi eng arzon narx + ustama</b>{" "}
          (dorixona foizi). Qolgan hamma doriga — <b>tan narx + ustama</b>, foizi 0 dan boshlanadi
          va uni jadvaldagi &laquo;Ustama %&raquo; katakchasiga o&apos;zingiz yozasiz. Foiz
          yozilmaguncha tavsiya ko&apos;rsatilmaydi — aks holda tavsiya tan narxning o&apos;zi
          bo&apos;lib qolardi. Bitta doriga yozilgan foiz dorixona foizidan ustun turadi.
        </p>
        <p>
          &laquo;Asos&raquo; ustunidagi <b>Tan narx</b> yozuvini bossangiz, o&apos;sha doriga
          arzonapteka havolasini biriktirasiz — shundan keyin tavsiya raqobatchi narxidan
          hisoblanadi. Narxni F-Apteka&apos;da qo&apos;lda qo&apos;yasiz: F-Apteka tashqaridan
          narx yozishga ruxsat bermaydi.
        </p>
      </div>
    </div>
  );
}
