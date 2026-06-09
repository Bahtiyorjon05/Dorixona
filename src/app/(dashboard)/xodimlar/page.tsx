import { getEmployeesData } from "@/lib/queries";
import { formatNumber } from "@/lib/format";
import { Badge, Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; color: "green" | "amber" | "red" | "blue" }> = {
  ACTIVE: { label: "Aktiv", color: "green" },
  ON_LEAVE: { label: "Ta'tilda", color: "amber" },
  INACTIVE: { label: "Faol emas", color: "red" },
};

const AVATAR_COLORS = ["#1a7f5a", "#378add", "#f59e0b", "#e24b4a", "#7f77dd"];

function kpiColor(kpi: number | null) {
  if (kpi == null) return "var(--c-muted)";
  if (kpi >= 90) return "var(--c-primary)";
  if (kpi >= 80) return "var(--c-accent)";
  return "var(--c-danger)";
}

export default async function XodimlarPage() {
  const employees = await getEmployeesData();

  return (
    <div>
      <PageHeader
        title="Xodimlar boshqaruvi"
        subtitle="Filial xodimlari ro'yxati va ma'lumotlari"
        action={
          <button className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white">
            + Yangi xodim
          </button>
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge text-left text-[11px] uppercase text-muted">
                <th className="pb-2 pr-3 font-medium">Xodim</th>
                <th className="pb-2 pr-3 font-medium">Lavozim</th>
                <th className="pb-2 pr-3 font-medium">Filial</th>
                <th className="pb-2 pr-3 font-medium">Maosh (base)</th>
                <th className="pb-2 pr-3 font-medium">Status</th>
                <th className="pb-2 font-medium">KPI</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e, i) => {
                const st = STATUS[e.status] ?? STATUS.ACTIVE;
                const initials = e.fullName
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("");
                return (
                  <tr key={e.id} className="border-b border-edge last:border-0 hover:bg-surface">
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-medium text-white"
                          style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                        >
                          {initials}
                        </div>
                        <span className="font-medium">{e.fullName}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-muted">{e.position}</td>
                    <td className="py-2.5 pr-3 text-muted">{e.branch}</td>
                    <td className="py-2.5 pr-3">{formatNumber(e.baseSalary)}</td>
                    <td className="py-2.5 pr-3">
                      <Badge color={st.color}>{st.label}</Badge>
                    </td>
                    <td className="py-2.5 font-medium" style={{ color: kpiColor(e.kpi) }}>
                      {e.kpi != null ? `${e.kpi}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
