import { getEmployeesData, getExpensesData } from "@/lib/queries";
import { formatNumber, formatSom, monthName } from "@/lib/format";
import { Card, MetricCard, PageHeader } from "@/components/ui";
import { EmployeesPanel } from "@/components/panels/EmployeesPanel";

export const dynamic = "force-dynamic";

export default async function XodimlarPage() {
  const [employees, expenses] = await Promise.all([getEmployeesData(), getExpensesData()]);

  const active = employees.filter((e) => e.status === "ACTIVE");
  const payroll = employees.reduce((sum, e) => sum + e.baseSalary, 0);
  const avg = employees.length ? payroll / employees.length : 0;

  // Harajatlarda SALARY toifasi bo'yicha haqiqiy to'langan oylik
  const paid = expenses.list.filter((e) => e.category === "SALARY");
  const paidTotal = paid.reduce((sum, e) => sum + e.amount, 0);
  const period = `${expenses.period.getFullYear()}-yil ${monthName(expenses.period.getMonth() + 1)}`;

  return (
    <div>
      <PageHeader
        title="Xodimlar boshqaruvi"
        subtitle="Filial xodimlari, oylik fondi va to'lovlar"
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard icon="👥" label="Xodimlar" value={String(employees.length)} sub={`${active.length} ta faol`} />
        <MetricCard icon="💵" label="Oylik fondi" value={formatNumber(payroll)} sub="Bazaviy maoshlar" />
        <MetricCard icon="📊" label="O'rtacha oylik" value={formatNumber(avg)} sub="Xodim boshiga" />
        <MetricCard
          icon="🧾"
          label={`To'langan (${monthName(expenses.period.getMonth() + 1)})`}
          value={formatNumber(paidTotal)}
          valueColor="var(--c-danger)"
          sub={`${paid.length} ta to'lov`}
        />
      </div>

      {paid.length > 0 && (
        <Card title={`${period} — oylik to'lovlari`} icon="💰" className="mb-5">
          <div className="space-y-2">
            {paid.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span>
                  {p.title}
                  {p.unit && <span className="text-muted"> · {p.unit}</span>}
                </span>
                <span>{formatSom(p.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-surface pt-2 text-sm font-medium">
              <span>Jami</span>
              <span>{formatSom(paidTotal)}</span>
            </div>
          </div>
        </Card>
      )}

      <EmployeesPanel employees={employees} />
    </div>
  );
}
