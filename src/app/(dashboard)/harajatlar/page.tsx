import { getExpensesData } from "@/lib/queries";
import { formatNumber, formatSom } from "@/lib/format";
import { Card, MetricCard, PageHeader } from "@/components/ui";
import { ExpensesPanel } from "@/components/panels/ExpensesPanel";

export const dynamic = "force-dynamic";

export default async function HarajatlarPage() {
  const d = await getExpensesData();

  return (
    <div>
      <PageHeader title="Harajatlar boshqaruvi" subtitle="Joriy oy harajatlari tahlili" />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Jami harajat (oy)" value={formatNumber(d.total)} valueColor="var(--c-danger)" />
        <MetricCard label="Ijara va kommunal" value={formatNumber(d.rent)} sub="Doimiy xarajat" />
        <MetricCard label="Maosh fondi" value={formatNumber(d.salary)} sub="Xodimlar + bonus" />
        <MetricCard label="Sotib olishlar" value={formatNumber(d.goods)} sub="Tovar" />
      </div>

      {d.byUnit.length > 1 && (
        <Card title="Dorixonalar kesimi" icon="🏪" className="mb-5">
          <div className="space-y-2">
            {d.byUnit.map((u) => (
              <div key={u.unit} className="flex items-center justify-between text-sm">
                <span>
                  {u.unit} <span className="text-muted">({u.count} ta)</span>
                </span>
                <span>{formatSom(u.amount)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <ExpensesPanel
        list={d.list.map((e) => ({
          id: e.id,
          title: e.title,
          category: e.category,
          amount: e.amount,
          spentAt: e.spentAt.toISOString(),
          isRecurring: e.isRecurring,
        }))}
      />
    </div>
  );
}
