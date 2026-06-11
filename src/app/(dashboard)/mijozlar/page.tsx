import { getCustomersData } from "@/lib/queries";
import { formatNumber } from "@/lib/format";
import { MetricCard, PageHeader } from "@/components/ui";
import { CustomersPanel } from "@/components/panels/CustomersPanel";

export const dynamic = "force-dynamic";

export default async function MijozlarPage() {
  const d = await getCustomersData();

  return (
    <div>
      <PageHeader
        title="Mijozlar va sodiqlik"
        subtitle="Telegram bot orqali ro'yxatdan o'tgan mijozlar va bonus ballari"
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Jami mijozlar" value={String(d.total)} valueColor="var(--c-primary)" />
        <MetricCard label="Telegram orqali" value={String(d.viaTelegram)} icon="📲" />
        <MetricCard label="Jami bonus ballari" value={formatNumber(d.totalPoints)} icon="⭐" />
        <MetricCard label="Oltin mijozlar" value={String(d.gold)} valueColor="var(--c-accent)" icon="🥇" />
      </div>

      <CustomersPanel customers={d.list} />
    </div>
  );
}
