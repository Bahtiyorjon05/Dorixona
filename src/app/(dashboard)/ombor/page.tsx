import { getInventoryData } from "@/lib/queries";
import { formatNumber } from "@/lib/format";
import { MetricCard, PageHeader } from "@/components/ui";
import { InventoryPanel } from "@/components/panels/InventoryPanel";

export const dynamic = "force-dynamic";

export default async function OmborPage() {
  const d = await getInventoryData();

  return (
    <div>
      <PageHeader title="Ombor holati" subtitle="Qoldiq va harakatlar nazorati" />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Jami pozitsiya" value={String(d.totalCount)} sub="Aktiv mahsulotlar" />
        <MetricCard
          label="Kam qoldiq"
          value={String(d.lowStock)}
          valueColor="var(--c-danger)"
          sub="Zudlik bilan buyurtma"
        />
        <MetricCard
          label="Muddati o'tayotgan"
          value={String(d.expiring)}
          valueColor="var(--c-accent)"
          sub="30 kun ichida"
        />
        <MetricCard label="Ombor qiymati" value={formatNumber(d.inventoryValue)} sub="Tan narxida" />
      </div>

      <InventoryPanel products={d.products} />
    </div>
  );
}
