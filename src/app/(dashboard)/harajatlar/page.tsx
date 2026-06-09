import { getExpensesData } from "@/lib/queries";
import { formatDate, formatNumber } from "@/lib/format";
import { Badge, Card, MetricCard, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const CATEGORY: Record<string, { label: string; icon: string; color: "green" | "amber" | "red" | "blue" }> = {
  RENT: { label: "Ijara", icon: "🏠", color: "amber" },
  UTILITIES: { label: "Kommunal", icon: "⚡", color: "blue" },
  GOODS: { label: "Tovar", icon: "🚚", color: "amber" },
  SALARY: { label: "Xodimlar", icon: "👥", color: "red" },
  LICENSE: { label: "Rasmiy", icon: "📜", color: "green" },
  OTHER: { label: "Boshqa", icon: "📌", color: "blue" },
};

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

      <Card
        title="Harajatlar ro'yxati"
        icon="🧾"
        action={
          <button className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white">
            + Qo'shish
          </button>
        }
      >
        <div className="flex flex-col">
          {d.list.map((e) => {
            const cat = CATEGORY[e.category] ?? CATEGORY.OTHER;
            return (
              <div
                key={e.id}
                className="flex items-center gap-3 border-b border-edge py-3 last:border-0"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface text-base">
                  {cat.icon}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{e.title}</div>
                  <div className="text-xs text-muted">{formatDate(e.spentAt)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{formatNumber(e.amount)}</div>
                  <Badge color={cat.color}>{e.isRecurring ? "Doimiy" : cat.label}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
