import { getExpensesData } from "@/lib/queries";
import { formatNumber, formatSom, monthName } from "@/lib/format";
import { Badge, Card, MetricCard, PageHeader } from "@/components/ui";
import { ExpensesPanel } from "@/components/panels/ExpensesPanel";
import { MonthlyFinancePanel } from "@/components/panels/MonthlyFinancePanel";
import { MonthPicker } from "@/components/MonthPicker";
import { FILIALS } from "@/lib/filial";
import { currentFilial } from "@/lib/filial-server";

export const dynamic = "force-dynamic";

/** ?oy=2026-08 — noto'g'ri qiymatda avtomatik tanlovga tushadi */
function parseMonth(raw: string | string[] | undefined): Date | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const match = /^(\d{4})-(\d{1,2})$/.exec(value ?? "");
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return undefined;
  return new Date(year, month - 1, 1);
}

const CATEGORY_LABEL: Record<string, string> = {
  RENT: "Ijara",
  UTILITIES: "Kommunal",
  GOODS: "Tovar",
  SALARY: "Oylik",
  LICENSE: "Soliq / litsenziya",
  OTHER: "Boshqa",
};

export default async function HarajatlarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const d = await getExpensesData(parseMonth((await searchParams).oy));
  const now = new Date();
  const isPast =
    d.period.getFullYear() !== now.getFullYear() || d.period.getMonth() !== now.getMonth();
  const label = `${d.period.getFullYear()}-yil ${monthName(d.period.getMonth() + 1)}`;

  const maxCat = Math.max(...d.byCategory.map((c) => c.amount), 1);
  const maxUnit = Math.max(...d.byUnit.map((u) => u.amount), 1);
  const totalProfit = d.monthlyUnits.reduce((s, u) => s + u.profit, 0);

  const monthKey = (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}`;

  // Yuqoridagi filial tanlovi bilan bir xil bo'lsin: aniq dorixona tanlangan
  // bo'lsa faqat o'sha kartochka, "Umumiy" da esa uchalasi ham ko'rinadi
  // ("Umumiy" — dorixonaga taqsimlanmagan summalar uchun alohida qator).
  const filial = await currentFilial();
  const visibleUnits = filial === "Umumiy" ? [...FILIALS] : [filial];

  return (
    <div>
      <PageHeader
        title="Harajatlar boshqaruvi"
        subtitle={`${label} — moliyaviy xulosa va xarajatlar`}
        action={
          <div className="flex items-center gap-2">
            {isPast && <Badge color="amber">o&apos;tgan oy</Badge>}
            <MonthPicker
              current={monthKey(d.period)}
              available={d.availableMonths.map(monthKey)}
              basePath="/harajatlar"
            />
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Jami harajat" value={formatNumber(d.total)} valueColor="var(--c-danger)" sub={`${d.list.length} ta yozuv`} />
        <MetricCard label="Ijara va kommunal" value={formatNumber(d.rent)} sub="Doimiy xarajat" />
        <MetricCard label="Maosh fondi" value={formatNumber(d.salary)} sub="Xodimlar" />
        {totalProfit > 0 ? (
          <MetricCard
            label="Sof foyda"
            value={formatNumber(totalProfit - d.total)}
            valueColor={totalProfit - d.total >= 0 ? "var(--c-success)" : "var(--c-danger)"}
            sub="Foyda − harajat"
          />
        ) : (
          <MetricCard label="Sotib olishlar" value={formatNumber(d.goods)} sub="Tovar" />
        )}
      </div>

      <MonthlyFinancePanel
        label={label}
        year={d.period.getFullYear()}
        month={d.period.getMonth() + 1}
        rows={d.monthlyUnits}
        allUnits={visibleUnits}
      />

      <div className="mb-5 grid gap-3 lg:grid-cols-2">
        <Card title="Dorixonalar bo'yicha harajat" icon="🏪">
          <div className="space-y-3">
            {d.byUnit.map((u) => (
              <div key={u.unit}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>
                    {u.unit} <span className="text-muted">({u.count} ta)</span>
                  </span>
                  <span className="text-muted">{formatSom(u.amount)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, (u.amount / maxUnit) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Toifalar bo'yicha" icon="📊">
          <div className="space-y-3">
            {d.byCategory.map((c) => (
              <div key={c.category}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{CATEGORY_LABEL[c.category] ?? c.category}</span>
                  <span className="text-muted">{formatSom(c.amount)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface">
                  <div className="h-full rounded-full bg-danger" style={{ width: `${Math.max(3, (c.amount / maxCat) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {d.debts.length > 0 && (
        <Card title="Qarzlar" icon="🧮" className="mb-5">
          <div className="space-y-3">
            {d.debts.map((q) => (
              <div key={q.id} className="border-b border-surface pb-3 last:border-0 last:pb-0">
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{q.counterparty}</span>
                  <Badge color={q.direction === "PAYABLE" ? "red" : "green"}>
                    {q.direction === "PAYABLE" ? "To'lashimiz kerak" : "Olishimiz kerak"}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Qoldiq</span>
                  <span>{formatSom(q.remaining)}</span>
                </div>
                {q.paid > 0 && (
                  <div className="flex justify-between text-xs text-muted">
                    <span>To&apos;langan</span>
                    <span>
                      {formatSom(q.paid)} / {formatSom(q.total)}
                    </span>
                  </div>
                )}
                {q.note && <p className="mt-1 text-xs text-muted">{q.note}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <ExpensesPanel
        units={d.byUnit.map((u) => u.unit).filter((u) => u !== "Umumiy")}
        list={d.list.map((e) => ({
          id: e.id,
          title: e.title,
          category: e.category,
          amount: e.amount,
          spentAt: e.spentAt.toISOString(),
          isRecurring: e.isRecurring,
          unit: e.unit,
        }))}
      />
    </div>
  );
}
