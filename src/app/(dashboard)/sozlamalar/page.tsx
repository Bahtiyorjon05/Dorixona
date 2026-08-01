import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Badge, Card, PageHeader } from "@/components/ui";
import { FaptekaSyncPanel } from "@/components/panels/FaptekaSyncPanel";
import { saveEmployeeAccess } from "@/lib/actions/settings";
import { db } from "@/lib/db";
import { formatDate, formatNumber, formatTime } from "@/lib/format";
import { getFaptekaEnvStatus, startOfMonthString, todayString } from "@/lib/integrations/fapteka/client";
import { FAPTEKA_REPORTS } from "@/lib/integrations/fapteka/mapping";
import { ensurePermissionTable, readUserAccess } from "@/lib/permission-db";
import { canAccessPermission, firstAllowedPath, PERMISSION_DEFS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const roleLabel: Record<string, string> = {
  OWNER: "Asosiy admin",
  MANAGER: "Menejer",
  PHARMACIST: "Farmatsevt",
  CASHIER: "Kassir",
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canAccessPermission(session.user.role, session.user.permissions, "sozlamalar")) {
    redirect(firstAllowedPath(session.user.role, session.user.permissions));
  }

  await ensurePermissionTable();
  const employees = await db.employee.findMany({
    orderBy: { createdAt: "asc" },
    include: { user: true, branch: true },
  });

  const rows = await Promise.all(
    employees.map(async (employee) => ({
      employee,
      access: employee.user ? await readUserAccess(employee.user.id, employee.user.role) : { permissions: [], editPermissions: [] },
    })),
  );
  const faptekaStatus = getFaptekaEnvStatus();
  const faptekaReports = Object.values(FAPTEKA_REPORTS).filter((report) => report.preferred);
  const faptekaProductStats = await db.product.aggregate({
    where: { isActive: true, sku: { startsWith: "FA:" } },
    _count: { _all: true },
    _sum: { stock: true },
    _max: { updatedAt: true },
  });
  const faptekaUpdatedAt = faptekaProductStats._max.updatedAt;
  const faptekaBadge =
    faptekaProductStats._count._all > 0 ? (
      <Badge color="green">SITE ishlayapti</Badge>
    ) : faptekaStatus.hasSiteToken ? (
      <Badge color="blue">SITE tayyor</Badge>
    ) : faptekaStatus.configured ? (
      <Badge color="green">REPORT sozlangan</Badge>
    ) : (
      <Badge color="amber">.env kerak</Badge>
    );

  return (
    <div>
      <PageHeader
        title="Sozlamalar"
        subtitle="Xodim loginlari va bo'limlarga kirish/o'zgartirish ruxsatlari"
      />

      <div className="space-y-4">
        <Card
          title="F-Apteka integratsiyasi"
          icon="🔄"
          action={faptekaBadge}
        >
          <div className="mb-4 grid gap-2 text-sm md:grid-cols-3">
            <div className="rounded-lg bg-surface p-3">
              <div className="text-xs text-muted">Tushgan mahsulot</div>
              <div className="mt-1 font-medium">{formatNumber(faptekaProductStats._count._all)} ta</div>
            </div>
            <div className="rounded-lg bg-surface p-3">
              <div className="text-xs text-muted">F-Apteka qoldiq jami</div>
              <div className="mt-1 font-medium">{formatNumber(faptekaProductStats._sum.stock ?? 0)} dona</div>
            </div>
            <div className="rounded-lg bg-surface p-3">
              <div className="text-xs text-muted">Oxirgi kelgan vaqt</div>
              <div className="mt-1 font-medium">
                {faptekaUpdatedAt ? `${formatDate(faptekaUpdatedAt)} ${formatTime(faptekaUpdatedAt)}` : "Hali kelmagan"}
              </div>
            </div>
          </div>

          <div className="mb-4 grid gap-2 text-sm md:grid-cols-3">
            <div className="rounded-lg bg-surface p-3">
              <div className="text-xs text-muted">REPORT endpoint</div>
              <div className="mt-1 truncate font-medium">{faptekaStatus.endpoint}</div>
            </div>
            <div className="rounded-lg bg-surface p-3">
              <div className="text-xs text-muted">Filial ID</div>
              <div className="mt-1 font-medium">{faptekaStatus.filialId}</div>
            </div>
            <div className="rounded-lg bg-surface p-3">
              <div className="text-xs text-muted">Token</div>
              <div className="mt-1 font-medium">{faptekaStatus.hasToken ? "Bor" : "Yo'q"}</div>
            </div>
          </div>

          <div className="mb-4 grid gap-2 text-sm md:grid-cols-2">
            <div className="rounded-lg border border-edge bg-surface p-3">
              <div className="text-xs text-muted">SITE.exe push URL</div>
              <div className="mt-1 break-all font-medium">{faptekaStatus.sitePushUrl}</div>
            </div>
            <div className="rounded-lg border border-edge bg-surface p-3">
              <div className="text-xs text-muted">SITE.exe TOCING token</div>
              <div className="mt-1 font-medium">{faptekaStatus.hasSiteToken ? "Bor" : "Yo'q"}</div>
            </div>
          </div>

          <div className="mb-4 rounded-lg border border-edge bg-surface p-3 text-sm text-muted">
            SITE.exe mahsulot, narx va qoldiqni avtomatik yuboradi; qo'lda bosiladigan sync tugmasi unga tegishli emas.
            Pastdagi REPORT sync tugmasi savdo, chek, kirim va qaytarish reportlarini F-Apteka'dan tortish uchun.
            Write API yo'q, shuning uchun F-Apteka mahsulot/narx/qoldiq F-Apteka tomonda o'zgaradi, ERP esa o'qib yangilaydi.
          </div>

          <FaptekaSyncPanel
            defaultDateFrom={startOfMonthString()}
            defaultDateTo={todayString()}
            reportConfigured={faptekaStatus.configured}
          />

          <div className="mt-4 overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Report</th>
                  <th>F-Apteka ma'lumoti</th>
                  <th>ERP ga tushadigan joy</th>
                </tr>
              </thead>
              <tbody>
                {faptekaReports.map((report) => (
                  <tr key={report.key}>
                    <td className="whitespace-nowrap">#{report.id}</td>
                    <td>{report.title}</td>
                    <td>{report.erpTarget}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {rows.map(({ employee, access }) => (
          <Card
            key={employee.id}
            title={employee.fullName}
            icon="⚙️"
            action={
              employee.user?.isActive ? <Badge color="green">Login aktiv</Badge> : <Badge color="amber">Login yo'q</Badge>
            }
          >
            <form action={saveEmployeeAccess} className="space-y-4">
              <input type="hidden" name="employeeId" value={employee.id} />
              <div className="grid gap-3 md:grid-cols-4">
                <label className="text-xs font-medium text-muted">
                  Email
                  <input
                    name="email"
                    type="email"
                    required
                    defaultValue={employee.user?.email ?? ""}
                    placeholder="xodim@dorixona.uz"
                    className="mt-1 w-full rounded-lg border border-edge bg-card px-3 py-2 text-sm text-fg outline-none focus:border-primary"
                  />
                </label>
                <label className="text-xs font-medium text-muted">
                  Parol
                  <input
                    name="password"
                    type="password"
                    placeholder={employee.user ? "O'zgartirmaslik uchun bo'sh" : "kamida 6 belgi"}
                    className="mt-1 w-full rounded-lg border border-edge bg-card px-3 py-2 text-sm text-fg outline-none focus:border-primary"
                  />
                </label>
                <label className="text-xs font-medium text-muted">
                  Role
                  <select
                    name="role"
                    defaultValue={employee.user?.role ?? "PHARMACIST"}
                    className="mt-1 w-full rounded-lg border border-edge bg-card px-3 py-2 text-sm text-fg outline-none focus:border-primary"
                  >
                    {Object.entries(roleLabel).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-end gap-2 rounded-lg border border-edge bg-card px-3 py-2 text-sm text-muted">
                  <input name="isActive" type="checkbox" defaultChecked={employee.user?.isActive ?? true} />
                  Login aktiv
                </label>
              </div>

              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>Bo'lim</th>
                      <th>Kirish</th>
                      <th>O'zgartirish</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PERMISSION_DEFS.map((permission) => (
                      <tr key={permission.key}>
                        <td>{permission.label}</td>
                        <td>
                          <input
                            name="permissions"
                            type="checkbox"
                            value={permission.key}
                            defaultChecked={access.permissions.includes(permission.key)}
                          />
                        </td>
                        <td>
                          <input
                            name="editPermissions"
                            type="checkbox"
                            value={permission.key}
                            defaultChecked={access.editPermissions.includes(permission.key)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">
                Saqlash
              </button>
            </form>
          </Card>
        ))}
      </div>
    </div>
  );
}
