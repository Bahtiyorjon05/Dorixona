import "server-only";
import { db } from "@/lib/db";
import { getCashierData, nameKey, namesMatch } from "@/lib/cashiers";
import { retailTotals, utcDay } from "@/lib/monthly-finance";
import { formatNumber } from "@/lib/format";
import { runningOut } from "@/lib/telegram/digest";

/**
 * Hisobotlar sahifasi — jonli ma'lumotdan.
 *
 *  - Korrelyatsiya: kassir smenalaridan (F-Apteka cheklari) shu oy savdo va
 *    foyda, KPI balli bilan. Avval ERP xodim cheklaridan olinardi — F-Apteka
 *    cheklarida ERP xodimi yo'q, shuning uchun doim bo'sh turardi.
 *  - Tavsiyalar: savdo o'sishi, eng yaxshi kassir, to'lov turlari,
 *    pereotsenka, qarzlar, tugayotgan tovar — hammasi hisoblanadi.
 */

export type CorrelationRow = {
  key: string;
  label: string;
  unit: string;
  net: number;
  /** QQSsiz foyda; tan narx kelmagan bo'lsa null */
  profit: number | null;
  kpi: number | null;
};

export type Insight = { tone: "good" | "warn" | "info" | "bad"; text: string };

const mln = (value: number) => `${formatNumber(Math.round(value / 100_000) / 10)} mln`;
const VAT = 1.12;

/** Smena tan narxlari — ustun Prisma sxemasida yo'q (prisma/manual/smena-tan-narx.sql) */
async function shiftCosts(from: Date, to: Date) {
  try {
    const rows = await db.$queryRaw<{ unit: string; userId: string; cost: number; net: number }[]>`
      SELECT "unit", "userId", SUM("cost")::float8 AS cost, SUM("sales" - "returns")::float8 AS net
      FROM "CashierShift"
      WHERE "day" >= ${from} AND "day" < ${to} AND "cost" IS NOT NULL
      GROUP BY "unit", "userId"`;
    return new Map(rows.map((r) => [`${r.unit}|${r.userId}`, { cost: Number(r.cost), net: Number(r.net) }]));
  } catch {
    return new Map<string, { cost: number; net: number }>();
  }
}

export async function getReportInsights(now = new Date()) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  // O'tgan oyning shu kunigacha — adolatli taqqoslash
  const prevSameDay = new Date(now.getFullYear(), now.getMonth() - 1, Math.min(now.getDate(), 28));
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [kassa, costs, kpis, employees, thisMonth, prevMonth, payRows, revalRows, debts, lowStock] =
    await Promise.all([
      getCashierData({ from: monthStart, to: now, unit: null }),
      shiftCosts(utcDay(monthStart), utcDay(new Date(now.getTime() + 864e5))),
      db.kpiRecord.findMany({ where: { year, month }, select: { employeeId: true, totalScore: true } }).catch(() => []),
      db.employee
        .findMany({ where: { status: { not: "INACTIVE" } }, select: { id: true, fullName: true, unit: true } })
        .catch(() => []),
      retailTotals(utcDay(monthStart), utcDay(new Date(now.getTime() + 864e5)), null),
      retailTotals(utcDay(prevStart), utcDay(new Date(prevSameDay.getTime() + 864e5)), null),
      db.dailySales
        .groupBy({
          by: ["docType"],
          _sum: { amount: true },
          where: { day: { gte: utcDay(monthStart) }, docType: { startsWith: "PAY:" } },
        })
        .catch(() => []),
      db.monthlyFinance
        .findMany({
          where: { periodMonth: new Date(Date.UTC(year, month - 1, 1)), unit: { not: "Umumiy" } },
          select: { unit: true, revaluation: true },
        })
        .catch(() => []),
      db.debt
        .findMany({
          where: { closedAt: null, dueDate: { not: null, lte: now } },
          select: { counterparty: true, totalAmount: true, paidAmount: true, currency: true },
        })
        .catch(() => []),
      // Telegram ombor eslatmasi bilan bir xil mezon: qoldiq <= 3 va oxirgi
      // 30 kunda 20+ dona sotilgan. Sotilmay turganlar sanalmaydi.
      runningOut(3).catch(() => ({ rows: [], count: 0 })),
    ]);

  // ─── Korrelyatsiya: kassirlar ───
  const kpiByEmployee = new Map(kpis.map((k) => [k.employeeId, k.totalScore]));
  const keyedEmployees = employees.map((e) => ({ ...e, key: nameKey(e.fullName) }));
  const correlation: CorrelationRow[] = kassa.cashiers.map((c) => {
    const userId = c.key.split("|")[1];
    const costRow = costs.get(`${c.unit}|${userId}`);
    let match = keyedEmployees.filter((e) => namesMatch(nameKey(c.cashier), e.key));
    if (match.length > 1) match = match.filter((e) => e.unit === c.unit);
    const kpi = match.length === 1 ? (kpiByEmployee.get(match[0].id) ?? null) : null;
    return {
      key: c.key,
      label: c.cashier,
      unit: c.unit,
      net: c.net,
      profit: costRow ? (costRow.net - costRow.cost) / VAT : null,
      kpi,
    };
  });

  // ─── Tavsiyalar ───
  const insights: Insight[] = [];

  if (thisMonth.known && prevMonth.known && prevMonth.turnover > 0) {
    const growth = ((thisMonth.turnover - prevMonth.turnover) / prevMonth.turnover) * 100;
    insights.push({
      tone: growth >= 0 ? "good" : "bad",
      text:
        `Shu oy savdo ${mln(thisMonth.turnover)} — o'tgan oyning shu kunigacha ` +
        `${growth >= 0 ? "+" : ""}${growth.toFixed(1)}% (${mln(prevMonth.turnover)}). ` +
        `Foyda ${mln(thisMonth.profit)}.`,
    });
  }

  const ranked = [...correlation].sort((a, b) => (b.profit ?? b.net) - (a.profit ?? a.net));
  if (ranked[0]) {
    const top = ranked[0];
    const shareRow = kassa.cashiers.find((c) => c.key === top.key);
    insights.push({
      tone: "good",
      text:
        `${top.label} (${top.unit}) shu oy eng ko'p ${top.profit !== null ? "foyda" : "savdo"} keltirdi: ` +
        `${mln(top.profit ?? top.net)}` +
        (shareRow ? `, savdoning ${shareRow.share.toFixed(0)}% i, o'rtacha chek ${formatNumber(Math.round(shareRow.avgCheck))} so'm` : "") +
        ".",
    });
  }

  const payTotal = payRows.reduce((s, r) => s + Number(r._sum.amount ?? 0), 0);
  const cash = payRows.filter((r) => r.docType === "PAY:1").reduce((s, r) => s + Number(r._sum.amount ?? 0), 0);
  if (payTotal > 0) {
    insights.push({
      tone: "info",
      text: `To'lovlar: naqd ${((cash / payTotal) * 100).toFixed(0)}%, karta ${(((payTotal - cash) / payTotal) * 100).toFixed(0)}% (shu oy ${mln(payTotal)}).`,
    });
  }

  const reval = revalRows.reduce((s, r) => s + Number(r.revaluation), 0);
  if (reval !== 0) {
    insights.push({
      tone: reval > 0 ? "warn" : "good",
      text:
        reval > 0
          ? `Shu oy pereotsenkadan zarar ${mln(reval)} — narxi tushirilgan tovarlar.`
          : `Shu oy pereotsenka +${mln(-reval)} — narx ko'proq ko'tarilgan.`,
    });
  }

  if (debts.length) {
    const sum = debts
      .filter((d) => d.currency === "UZS")
      .reduce((s, d) => s + Number(d.totalAmount) - Number(d.paidAmount), 0);
    insights.push({
      tone: "bad",
      text:
        `Muddati o'tgan ${debts.length} ta qarz` +
        (sum > 0 ? ` (${mln(sum)})` : "") +
        `: ${debts.slice(0, 3).map((d) => d.counterparty).join(", ")}${debts.length > 3 ? "…" : ""}.`,
    });
  }

  if (lowStock.count > 0) {
    insights.push({
      tone: "warn",
      text:
        `${formatNumber(lowStock.count)} ta tez sotiladigan dori tugayapti (3 donadan kam qoldi, oxirgi 30 kunda 20+ sotilgan): ` +
        `${lowStock.rows.map((r) => r.name).join(", ")}${lowStock.count > lowStock.rows.length ? "…" : ""} — buyurtma bering.`,
    });
  }

  if (!insights.length) insights.push({ tone: "info", text: "Bu oy uchun ma'lumot hali kelmagan." });

  return { correlation, insights, hasCost: costs.size > 0 };
}
