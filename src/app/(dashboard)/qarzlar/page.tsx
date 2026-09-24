import { Card, MetricCard, PageHeader } from "@/components/ui";
import { DebtsPanel } from "@/components/panels/DebtsPanel";
import { FILIALS } from "@/lib/filial";
import { formatDate, formatNumber } from "@/lib/format";
import { getDebtsData } from "@/lib/queries";

export const dynamic = "force-dynamic";

function money(amount: number, currency: "UZS" | "USD") {
  return currency === "USD" ? `$${formatNumber(Math.round(amount))}` : formatNumber(amount);
}

export default async function QarzlarPage() {
  const d = await getDebtsData();
  const units = FILIALS.filter((unit) => unit !== "Umumiy");

  return (
    <div>
      <PageHeader
        title="Qarzlar"
        subtitle="Firmalardan olingan tovar qarzi — qancha berildi, qancha qoldi"
      />

      {d.needsMigration && (
        <div className="mb-5 rounded-lg border border-danger bg-danger-light p-3 text-sm">
          <b>Jadval hali yaratilmagan.</b> Supabase → SQL Editor da{" "}
          <code>prisma/manual/qarzlar.sql</code> faylini ishga tushiring, shundan keyin bu bo&apos;lim
          ishlaydi.
        </div>
      )}

      {(d.overdue.length > 0 || d.dueSoon.length > 0) && (
        <div className="mb-5 space-y-2">
          {d.overdue.length > 0 && (
            <div className="rounded-lg border border-danger bg-danger-light p-3 text-sm">
              <b>Muddati o&apos;tgan {d.overdue.length} ta qarz:</b>{" "}
              {d.overdue
                .map((debt) => `${debt.counterparty} — ${money(debt.remaining, debt.currency)}`)
                .join(" · ")}
            </div>
          )}
          {d.dueSoon.length > 0 && (
            <div className="rounded-lg border border-edge bg-accent-light p-3 text-sm">
              <b>Muddati yaqin {d.dueSoon.length} ta qarz:</b>{" "}
              {d.dueSoon
                .map(
                  (debt) =>
                    `${debt.counterparty} — ${money(debt.remaining, debt.currency)} (${
                      debt.dueDate ? formatDate(debt.dueDate) : ""
                    })`,
                )
                .join(" · ")}
            </div>
          )}
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          icon="🏢"
          label="Jami qarz (so'm)"
          value={formatNumber(d.totals.uzs)}
          valueColor="var(--c-danger)"
        />
        <MetricCard
          icon="💵"
          label="Jami qarz (dollar)"
          value={`$${formatNumber(Math.round(d.totals.usd))}`}
        />
        <MetricCard icon="📋" label="Ochiq qarzlar" value={String(d.openCount)} sub="Yopilmaganlari" />
        <MetricCard
          icon="⏳"
          label="Muddati yaqin yoki o'tgan"
          value={String(d.overdue.length + d.dueSoon.length)}
          valueColor={d.overdue.length > 0 ? "var(--c-danger)" : undefined}
          sub={`${d.overdue.length} ta shoshilinch`}
        />
      </div>

      <Card title="Qarzlar ro'yxati" icon="💳">
        <DebtsPanel debts={d.debts} units={[...units]} />
      </Card>

      <p className="mt-4 text-xs text-muted">
        F-Apteka&apos;da firmadan tovar olinsa, qarz o&apos;zi yoziladi. Pul berilganda
        &laquo;To&apos;lov&raquo; tugmasi bilan kiritasiz — qoldiq shundan hisoblanadi. Muddatiga 10
        kundan kam qolsa qizil, 20 kundan kam qolsa sariq bo&apos;lib turadi.
      </p>
    </div>
  );
}
