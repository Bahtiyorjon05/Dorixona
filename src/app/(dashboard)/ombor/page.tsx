import { getInventoryData } from "@/lib/queries";
import { formatDate, formatNumber, formatTime } from "@/lib/format";
import { MetricCard, PageHeader } from "@/components/ui";
import { InventoryPanel } from "@/components/panels/InventoryPanel";
import { getStockByUnit } from "@/lib/stock-by-unit";
import { currentFilial } from "@/lib/filial-server";

export const dynamic = "force-dynamic";

export default async function OmborPage() {
  const [d, stock, filial] = await Promise.all([getInventoryData(), getStockByUnit(), currentFilial()]);
  const in30 = new Date(Date.now() + 30 * 864e5);

  // Dorixona bo'yicha qoldiq SITE.exe'dan. "Umumiy"da har dorixona alohida
  // ustunda, dorixona tanlansa — faqat o'sha dorixonadagi qoldiq.
  const withUnits = d.products.map((p) => ({ ...p, byUnit: (p.sku && stock.bySku.get(p.sku)) || undefined }));
  const unitView = stock.known && filial !== "Umumiy";
  const products = unitView
    ? withUnits
        .filter((p) => (p.byUnit?.[filial] ?? 0) > 0)
        .map((p) => ({ ...p, stock: p.byUnit?.[filial] ?? 0 }))
    : withUnits;
  const view = unitView
    ? {
        totalCount: products.length,
        lowStock: products.filter((p) => p.stock < p.minStock).length,
        expiring: products.filter((p) => p.expiryDate && new Date(p.expiryDate) <= in30).length,
        inventoryValue: products.reduce((sum, p) => sum + p.stock * p.costPrice, 0),
      }
    : { totalCount: d.totalCount, lowStock: d.lowStock, expiring: d.expiring, inventoryValue: d.inventoryValue };

  return (
    <div>
      <PageHeader title="Ombor holati" subtitle={unitView ? `${filial} dorixonasi qoldig'i` : "Qoldiq va harakatlar nazorati"} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard label="Jami pozitsiya" value={String(view.totalCount)} sub="Aktiv mahsulotlar" />
        <MetricCard
          label="F-Apteka"
          value={String(d.faptekaCount)}
          valueColor="var(--c-primary)"
          sub={d.faptekaLastUpdated ? `${formatDate(d.faptekaLastUpdated)} ${formatTime(d.faptekaLastUpdated)}` : "Hali kelmagan"}
        />
        <MetricCard
          label="Kam qoldiq"
          value={String(view.lowStock)}
          valueColor="var(--c-danger)"
          sub="Zudlik bilan buyurtma"
        />
        <MetricCard
          label="Muddati o'tayotgan"
          value={String(view.expiring)}
          valueColor="var(--c-accent)"
          sub="30 kun ichida"
        />
        <MetricCard label="Ombor qiymati" value={formatNumber(Math.round(view.inventoryValue))} sub="Tan narxida" />
      </div>

      <InventoryPanel
        products={products}
        unitColumns={stock.known && filial === "Umumiy" ? stock.units : []}
      />
    </div>
  );
}
