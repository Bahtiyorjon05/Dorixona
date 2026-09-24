import Link from "next/link";
import { Badge, Card, MetricCard, PageHeader, TrendDown, TrendUp } from "@/components/ui";
import { formatDate, formatNumber, formatTime } from "@/lib/format";
import { getDashboardData, getDebtsData } from "@/lib/queries";

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/savdo", label: "Savdo", icon: "💹" },
  { href: "/moliya", label: "Moliya", icon: "📈" },
  { href: "/harajatlar", label: "Harajatlar", icon: "🧾" },
  { href: "/qarzlar", label: "Qarzlar", icon: "💳" },
  { href: "/ombor", label: "Ombor", icon: "📦" },
  { href: "/analitika", label: "Analitika", icon: "📉" },
];

function money(amount: number, currency: "UZS" | "USD") {
  return currency === "USD" ? `$${formatNumber(Math.round(amount))}` : `${formatNumber(amount)} so'm`;
}

export default async function BoshqaruvPage() {
  const [d, debts] = await Promise.all([getDashboardData(), getDebtsData()]);
  const margin = d.monthTurnover > 0 ? (d.monthProfit / d.monthTurnover) * 100 : 0;

  return (
    <div>
      <PageHeader
        title="Dorixona — bosh sahifa"
        subtitle={`Umumiy holat${d.filial === "Umumiy" ? "" : ` — ${d.filial}`}`}
      />

      {(debts.overdue.length > 0 || debts.dueSoon.length > 0) && (
        <Link
          href="/qarzlar"
          className={`mb-5 block rounded-lg border p-3 text-sm ${
            debts.overdue.length > 0 ? "border-danger bg-danger-light" : "border-edge bg-accent-light"
          }`}
        >
          {debts.overdue.length > 0 && (
            <div>
              🔴 <b>Muddati o&apos;tgan {debts.overdue.length} ta qarz</b> —{" "}
              {debts.overdue
                .map((debt) => `${debt.counterparty} (${money(debt.remaining, debt.currency)})`)
                .join(", ")}
            </div>
          )}
          {debts.dueSoon.length > 0 && (
            <div className={debts.overdue.length > 0 ? "mt-1" : undefined}>
              🟡 Muddati yaqin {debts.dueSoon.length} ta qarz —{" "}
              {debts.dueSoon.map((debt) => debt.counterparty).join(", ")}
            </div>
          )}
        </Link>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          icon="🪙"
          label="Bugungi savdo"
          value={formatNumber(d.todaySales)}
          sub={
            d.yesterdaySales > 0 ? (
              <>
                {d.todayTrend >= 0 ? (
                  <TrendUp>{Math.abs(d.todayTrend).toFixed(1)}%</TrendUp>
                ) : (
                  <TrendDown>{Math.abs(d.todayTrend).toFixed(1)}%</TrendDown>
                )}{" "}
                kechadan
              </>
            ) : (
              "Kecha savdo yo'q edi"
            )
          }
        />
        <MetricCard icon="📊" label="Shu oy tushum" value={formatNumber(d.monthTurnover)} />
        <MetricCard
          icon="📈"
          label="Shu oy foyda"
          value={formatNumber(d.monthProfit)}
          valueColor="var(--c-primary)"
          sub={`Marja ${margin.toFixed(1)}%`}
        />
        <MetricCard
          icon="📦"
          label="Ombor qiymati"
          value={formatNumber(d.stockValue)}
          sub={`${formatNumber(d.stockPositions)} pozitsiya`}
        />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <Card title="Qoldig'i tugayotgan" icon="⚠️">
          {d.lowStock.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Hammasi yetarli.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tovar</th>
                  <th>Qoldiq</th>
                </tr>
              </thead>
              <tbody>
                {d.lowStock.map((item) => (
                  <tr key={item.id}>
                    <td className="max-w-[280px] truncate" title={item.name}>
                      {item.name}
                    </td>
                    <td>
                      {item.stock === 0 ? <Badge color="red">tugagan</Badge> : `${item.stock} dona`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Muddati yaqin dorilar" icon="⏳">
          {d.expiring.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">30 kun ichida muddati tugaydigan yo&apos;q.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tovar</th>
                  <th>Muddat</th>
                  <th>Qoldiq</th>
                </tr>
              </thead>
              <tbody>
                {d.expiring.map((item) => (
                  <tr key={item.id}>
                    <td className="max-w-[220px] truncate" title={item.name}>
                      {item.name}
                    </td>
                    <td className="whitespace-nowrap">{formatDate(item.expiryDate)}</td>
                    <td>{item.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Card title="Bo'limlar" icon="🧭">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex flex-col items-center gap-1 rounded-lg border border-edge px-3 py-4 text-sm transition hover:border-primary"
            >
              <span className="text-xl">{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </div>
      </Card>

      <p className="mt-4 text-xs text-muted">
        {d.lastSync
          ? `F-Apteka oxirgi yangilanish: ${formatDate(d.lastSync.at)} ${formatTime(d.lastSync.at)}`
          : "F-Apteka'dan hali ma'lumot kelmagan"}
      </p>
    </div>
  );
}
