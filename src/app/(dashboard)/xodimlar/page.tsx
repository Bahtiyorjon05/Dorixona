import { getEmployeesData } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import { EmployeesPanel } from "@/components/panels/EmployeesPanel";

export const dynamic = "force-dynamic";

export default async function XodimlarPage() {
  const employees = await getEmployeesData();

  return (
    <div>
      <PageHeader
        title="Xodimlar boshqaruvi"
        subtitle="Filial xodimlari ro'yxati va ma'lumotlari"
      />
      <EmployeesPanel employees={employees} />
    </div>
  );
}
