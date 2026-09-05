import { getEmployeesData } from "@/lib/queries";
import { formatNumber } from "@/lib/format";
import { MetricCard, PageHeader } from "@/components/ui";
import { EmployeesPanel } from "@/components/panels/EmployeesPanel";
import { currentFilial } from "@/lib/filial-server";

export const dynamic = "force-dynamic";

export default async function XodimlarPage() {
  const [employees, filial] = await Promise.all([getEmployeesData(), currentFilial()]);

  const active = employees.filter((e) => e.status === "ACTIVE");
  const payroll = employees.reduce((sum, e) => sum + e.baseSalary, 0);
  const avg = employees.length ? payroll / employees.length : 0;

  return (
    <div>
      <PageHeader
        title="Xodimlar boshqaruvi"
        subtitle={
          filial === "Umumiy"
            ? "Barcha filiallar xodimlari va oylik fondi"
            : `${filial} filiali xodimlari va oylik fondi`
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard icon="👥" label="Xodimlar" value={String(employees.length)} sub={`${active.length} ta faol`} />
        <MetricCard icon="💵" label="Oylik fondi" value={formatNumber(payroll)} sub="Bazaviy maoshlar" />
        <MetricCard icon="📊" label="O'rtacha oylik" value={formatNumber(avg)} sub="Xodim boshiga" />
        <MetricCard
          icon="🏪"
          label="Filial"
          value={filial}
          sub={filial === "Umumiy" ? "Barcha filiallar" : "Tanlangan filial"}
        />
      </div>

      <EmployeesPanel employees={employees} />
    </div>
  );
}
