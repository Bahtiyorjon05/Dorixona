import { getInventoryData } from "@/lib/queries";
import { formatNumber } from "@/lib/format";
import { Badge, Card, MetricCard, PageHeader } from "@/components/ui";

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

      <Card title="Ombor jadvali" icon="🔍">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge text-left text-[11px] uppercase text-muted">
                <th className="pb-2 pr-3 font-medium">Mahsulot</th>
                <th className="pb-2 pr-3 font-medium">Kategoriya</th>
                <th className="pb-2 pr-3 font-medium">Qoldiq</th>
                <th className="pb-2 pr-3 font-medium">Min norma</th>
                <th className="pb-2 pr-3 font-medium">Narx (dona)</th>
                <th className="pb-2 font-medium">Holat</th>
              </tr>
            </thead>
            <tbody>
              {d.products.map((p) => (
                <tr key={p.id} className="border-b border-edge last:border-0 hover:bg-surface">
                  <td className="py-2.5 pr-3 font-medium">{p.name}</td>
                  <td className="py-2.5 pr-3 text-muted">{p.category}</td>
                  <td className="py-2.5 pr-3">{p.stock} dona</td>
                  <td className="py-2.5 pr-3 text-muted">{p.minStock}</td>
                  <td className="py-2.5 pr-3">{formatNumber(p.salePrice)}</td>
                  <td className="py-2.5">
                    <Badge color={p.status.color}>{p.status.label}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
