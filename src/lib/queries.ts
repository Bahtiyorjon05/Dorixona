import { auth } from "@/auth";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { activeBranch } from "@/lib/actions/_shared";
import { monthName } from "@/lib/format";
import { isFaptekaExpenseTitle, isFaptekaSku } from "@/lib/integrations/fapteka/mapping";
import { unitWhere } from "@/lib/filial";
import { currentFilial } from "@/lib/filial-server";

/**
 * F-Apteka hujjat turi (DOCTYPE) → to'lov turi.
 *
 * 22-hisobotda har savdo hujjatining turi bor: 2 va 4 — chakana savdo.
 * Kuzatishimizcha biri naqd, ikkinchisi terminal. Agar teskari bo'lsa,
 * Vercel env orqali almashtiriladi:
 *   FAPTEKA_CASH_DOCTYPES="2"   FAPTEKA_CARD_DOCTYPES="4"
 */
function docTypeGroups() {
  const parse = (raw: string | undefined, fallback: string[]) => {
    const list = (raw ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    return new Set(list.length ? list : fallback);
  };
  return {
    cash: parse(process.env.FAPTEKA_CASH_DOCTYPES, ["2"]),
    card: parse(process.env.FAPTEKA_CARD_DOCTYPES, ["4"]),
  };
}

/** Oy ichidagi naqd/terminal taqsimoti — DailySales jadvalidan */
export async function cashSplit(from: Date, to: Date, unit: string | null) {
  const groups = docTypeGroups();
  let rows: { docType: string; amount: unknown }[] = [];
  try {
    rows = await db.dailySales.groupBy({
      by: ["docType"],
      _sum: { amount: true },
      where: { day: { gte: from, lt: to }, ...(unit ? { unit } : {}) },
    }).then((list) => list.map((row) => ({ docType: row.docType, amount: row._sum.amount })));
  } catch {
    // Jadval hali yaratilmagan
    return { cash: 0, card: 0, other: 0, total: 0, known: false };
  }

  let cash = 0;
  let card = 0;
  let other = 0;
  for (const row of rows) {
    const amount = num(row.amount);
    if (groups.cash.has(row.docType)) cash += amount;
    else if (groups.card.has(row.docType)) card += amount;
    else other += amount;
  }
  return { cash, card, other, total: cash + card + other, known: rows.length > 0 };
}

async function getBranchId() {
  const session = await auth();
  if (session?.user?.branchId) return session.user.branchId;
  return (await activeBranch()).id;
}

// ─── Sana yordamchilari ───
function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function startOfMonth(offset = 0, base = new Date()) {
  return new Date(base.getFullYear(), base.getMonth() + offset, 1);
}
const num = (v: unknown) => Number(v ?? 0);
/** MonthlyFinance.periodMonth uchun: oy boshi UTC yarim tunda */
export function utcMonthStart(d: Date) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1));
}
const M = (v: unknown) => num(v) / 1_000_000; // mln so'm

// ─────────────────────────────────────────────────────────────
//  MOLIYA
// ─────────────────────────────────────────────────────────────
export async function getFinanceData(period?: Date) {
  const branchId = await getBranchId();
  const today = startOfDay();
  const tomorrow = new Date(today.getTime() + 864e5);
  const yesterday = new Date(today.getTime() - 864e5);
  // Oy tanlansa oylik agregatlar o'sha oyga tayanadi; bugun/hafta jonli qoladi.
  const base = period ?? new Date();
  const monthStart = new Date(base.getFullYear(), base.getMonth(), 1);
  const nextMonth = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  const lastMonthStart = new Date(base.getFullYear(), base.getMonth() - 1, 1);
  const weekAgo = new Date(today.getTime() - 6 * 864e5);
  const sixMonthsAgo = startOfMonth(-5);

  const [
    todayAgg,
    yesterdayAgg,
    monthMargin,
    lastMonthMargin,
    payAgg,
    invValue,
    weekRows,
    catRows,
    seriesRows,
  ] = await Promise.all([
    db.sale.aggregate({ _sum: { total: true }, where: { branchId, createdAt: { gte: today, lt: tomorrow } } }),
    db.sale.aggregate({ _sum: { total: true }, where: { branchId, createdAt: { gte: yesterday, lt: today } } }),
    db.$queryRaw<{ margin: number }[]>`
      SELECT COALESCE(SUM(si."lineTotal" - si."costPrice" * si.quantity), 0)::float8 AS margin
      FROM "SaleItem" si JOIN "Sale" s ON s.id = si."saleId"
      WHERE s."branchId" = ${branchId} AND s."createdAt" >= ${monthStart} AND s."createdAt" < ${nextMonth}`,
    db.$queryRaw<{ margin: number }[]>`
      SELECT COALESCE(SUM(si."lineTotal" - si."costPrice" * si.quantity), 0)::float8 AS margin
      FROM "SaleItem" si JOIN "Sale" s ON s.id = si."saleId"
      WHERE s."branchId" = ${branchId} AND s."createdAt" >= ${lastMonthStart} AND s."createdAt" < ${monthStart}`,
    db.$queryRaw<{ method: string; sum: number }[]>`
      SELECT s."paymentMethod"::text AS method, COALESCE(SUM(s.total),0)::float8 AS sum
      FROM "Sale" s WHERE s."branchId" = ${branchId} AND s."createdAt" >= ${monthStart} AND s."createdAt" < ${nextMonth}
      GROUP BY 1`,
    db.$queryRaw<{ value: number }[]>`
      SELECT COALESCE(SUM(stock * "costPrice"),0)::float8 AS value FROM "Product" WHERE "isActive" = true AND "branchId" = ${branchId}`,
    db.$queryRaw<{ d: Date; total: number }[]>`
      SELECT date_trunc('day', s."createdAt") AS d, COALESCE(SUM(s.total),0)::float8 AS total
      FROM "Sale" s WHERE s."branchId" = ${branchId} AND s."createdAt" >= ${weekAgo}
      GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ category: string; revenue: number }[]>`
      SELECT p.category, COALESCE(SUM(si."lineTotal"),0)::float8 AS revenue
      FROM "SaleItem" si JOIN "Sale" s ON s.id = si."saleId" JOIN "Product" p ON p.id = si."productId"
      WHERE s."branchId" = ${branchId} AND s."createdAt" >= ${monthStart} GROUP BY p.category ORDER BY revenue DESC`,
    db.$queryRaw<{ m: Date; rev: number }[]>`
      SELECT date_trunc('month', s."createdAt") AS m, COALESCE(SUM(s.total),0)::float8 AS rev
      FROM "Sale" s WHERE s."branchId" = ${branchId} AND s."createdAt" >= ${sixMonthsAgo}
      GROUP BY 1 ORDER BY 1`,
  ]);

  const [expenseSeries, monthDailyRows] = await Promise.all([
    db.$queryRaw<{ m: Date; exp: number }[]>`
      SELECT date_trunc('month', e."spentAt") AS m, COALESCE(SUM(e.amount),0)::float8 AS exp
      FROM "Expense" e WHERE e."branchId" = ${branchId} AND e."spentAt" >= ${sixMonthsAgo}
      GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ d: Date; total: number }[]>`
      SELECT date_trunc('day', s."createdAt") AS d, COALESCE(SUM(s.total),0)::float8 AS total
      FROM "Sale" s WHERE s."branchId" = ${branchId} AND s."createdAt" >= ${monthStart} AND s."createdAt" < ${nextMonth}
      GROUP BY 1 ORDER BY 1`,
  ]);

  // Joriy oy — kunlik savdo (bugungacha)
  const monthDayMap = new Map(
    monthDailyRows.map((r) => [startOfDay(new Date(r.d)).getTime(), M(r.total)]),
  );
  const daysInMonthSoFar = today.getDate();
  const monthDaily = Array.from({ length: daysInMonthSoFar }, (_, i) => {
    const day = new Date(today.getFullYear(), today.getMonth(), i + 1);
    return { label: String(i + 1), value: +(monthDayMap.get(day.getTime()) ?? 0).toFixed(2) };
  });

  // Haftalik (7 kun, bo'sh kunlarni 0 bilan to'ldirish)
  const UZ = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Sha"];
  const weekMap = new Map(weekRows.map((r) => [startOfDay(new Date(r.d)).getTime(), M(r.total)]));
  const weekSales = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(today.getTime() - (6 - i) * 864e5);
    return { label: UZ[day.getDay()], value: +(weekMap.get(day.getTime()) ?? 0).toFixed(2) };
  });

  // Toifalar (top 4 + boshqa)
  const totalCat = catRows.reduce((s, r) => s + r.revenue, 0) || 1;
  const top = catRows.slice(0, 3);
  const restSum = catRows.slice(3).reduce((s, r) => s + r.revenue, 0);
  const categories = [
    ...top.map((r) => ({ name: r.category, value: Math.round((r.revenue / totalCat) * 100) })),
    ...(restSum > 0 ? [{ name: "Boshqa", value: Math.round((restSum / totalCat) * 100) }] : []),
  ];

  // 6 oylik seriya
  const expMap = new Map(expenseSeries.map((r) => [new Date(r.m).getTime(), M(r.exp)]));
  const profitSeries = Array.from({ length: 6 }, (_, i) => {
    const d = startOfMonth(-5 + i);
    const rev = seriesRows.find((r) => new Date(r.m).getTime() === d.getTime());
    return {
      label: monthName(d.getMonth() + 1).slice(0, 3),
      savdo: +(rev ? M(rev.rev) : 0).toFixed(1),
      xarajat: +(expMap.get(d.getTime()) ?? 0).toFixed(1),
    };
  });

  // ERP ichidagi POS savdolari (kam) — to'lov turi o'zida yozilgan
  const posCash = payAgg.find((p) => p.method === "CASH")?.sum ?? 0;
  const posCard = payAgg.find((p) => p.method === "CARD")?.sum ?? 0;
  const mixed = payAgg.find((p) => p.method === "MIXED")?.sum ?? 0;

  // F-Apteka savdosi: naqd va terminal hujjat turi bo'yicha ajratiladi.
  // Ajratish ma'lum bo'lsa, POS raqamlari o'rniga shu ishlatiladi —
  // aks holda hamma savdo "naqd" bo'lib ko'rinardi.
  const filial = await currentFilial();
  const split = await cashSplit(monthStart, nextMonth, filial === "Umumiy" ? null : filial);
  const cash = split.known ? split.cash : posCash;
  const card = split.known ? split.card : posCard;

  const todaySales = num(todayAgg._sum.total);
  const yesterdaySales = num(yesterdayAgg._sum.total) || 1;
  const margin = num(monthMargin[0]?.margin);
  const lastMargin = num(lastMonthMargin[0]?.margin) || 1;

  return {
    todaySales,
    todayTrend: ((todaySales - yesterdaySales) / yesterdaySales) * 100,
    monthlyProfit: margin,
    profitTrend: ((margin - lastMargin) / lastMargin) * 100,
    cashTotal: cash + card + mixed,
    cash,
    card,
    inventoryValue: num(invValue[0]?.value),
    weekSales,
    monthDaily,
    sixMonthSales: profitSeries.map((p) => ({ label: p.label, value: p.savdo })),
    categories,
    profitSeries,
  };
}

// ─────────────────────────────────────────────────────────────
//  OMBOR
// ─────────────────────────────────────────────────────────────
export type StockStatus = { label: string; color: "green" | "amber" | "red" };
export function stockStatus(stock: number, min: number): StockStatus {
  if (min > 0 && stock < min * 0.4) return { label: "Zudlik buyurtma", color: "red" };
  if (stock < min) return { label: "Kam qoldiq", color: "red" };
  if (stock < min * 1.2) return { label: "Chegarada", color: "amber" };
  return { label: "Yetarli", color: "green" };
}

export async function getInventoryData() {
  const branchId = await getBranchId();
  const in30 = new Date(Date.now() + 30 * 864e5);
  const [products, totalCount, valueRow] = await Promise.all([
    db.product.findMany({
      where: { isActive: true, branchId },
      orderBy: { name: "asc" },
    }),
    db.product.count({ where: { isActive: true, branchId } }),
    db.$queryRaw<{ value: number }[]>`
      SELECT COALESCE(SUM(stock * "costPrice"),0)::float8 AS value FROM "Product" WHERE "isActive" = true AND "branchId" = ${branchId}`,
  ]);

  const faptekaProducts = products.filter((p) => isFaptekaSku(p.sku));
  const lowStock = products.filter((p) => p.stock < p.minStock).length;
  const expiring = products.filter((p) => p.expiryDate && p.expiryDate <= in30).length;
  const faptekaLastUpdated = faptekaProducts.reduce<Date | null>((latest, product) => {
    if (!latest || product.updatedAt > latest) return product.updatedAt;
    return latest;
  }, null);

  return {
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      stock: p.stock,
      minStock: p.minStock,
      salePrice: num(p.salePrice),
      costPrice: num(p.costPrice),
      expiryDate: p.expiryDate ? p.expiryDate.toISOString().slice(0, 10) : null,
      fromFapteka: isFaptekaSku(p.sku),
      status: stockStatus(p.stock, p.minStock),
    })),
    totalCount,
    lowStock,
    expiring,
    faptekaCount: faptekaProducts.length,
    faptekaStock: faptekaProducts.reduce((sum, product) => sum + product.stock, 0),
    faptekaLastUpdated,
    inventoryValue: num(valueRow[0]?.value),
  };
}

// ─────────────────────────────────────────────────────────────
//  HARAJATLAR
// ─────────────────────────────────────────────────────────────
export async function getExpensesData(period?: Date) {
  const branchId = await getBranchId();

  // Oy berilmasa: joriy oyda yozuv bo'lmasa, ma'lumot bor eng oxirgi oyni ko'rsatamiz
  let monthStart: Date;
  if (period) {
    monthStart = new Date(period.getFullYear(), period.getMonth(), 1);
  } else {
    const current = startOfMonth(0);
    const [currentCount, currentFin] = await Promise.all([
      db.expense.count({ where: { branchId, spentAt: { gte: current, lt: startOfMonth(1) } } }),
      db.monthlyFinance.count({ where: { branchId, periodMonth: utcMonthStart(current) } }),
    ]);
    if (currentCount > 0 || currentFin > 0) {
      monthStart = current;
    } else {
      // Harajat ham, moliyaviy xulosa ham hisobga olinadi — aks holda
      // faqat moliya kiritilgan oy (masalan avgust) ochilmay qolardi
      const [lastExpense, lastFin] = await Promise.all([
        db.expense.findFirst({
          where: { branchId },
          orderBy: { spentAt: "desc" },
          select: { spentAt: true },
        }),
        db.monthlyFinance.findFirst({
          where: { branchId },
          orderBy: { periodMonth: "desc" },
          select: { periodMonth: true },
        }),
      ]);
      const candidates = [
        lastExpense && new Date(lastExpense.spentAt.getFullYear(), lastExpense.spentAt.getMonth(), 1),
        lastFin &&
          new Date(lastFin.periodMonth.getUTCFullYear(), lastFin.periodMonth.getUTCMonth(), 1),
      ].filter((d): d is Date => d !== null && d !== undefined);
      monthStart = candidates.length
        ? new Date(Math.max(...candidates.map((d) => d.getTime())))
        : current;
    }
  }
  const nextMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
  const filial = await currentFilial();
  const unitFilter = unitWhere(filial);
  const where = { branchId, spentAt: { gte: monthStart, lt: nextMonth }, ...unitFilter };

  const [list, totalAgg, byCat, byUnitRows, finRows, debtRows, allDates, finMonths] =
    await Promise.all([
      db.expense.findMany({ where, orderBy: { spentAt: "desc" } }),
      db.expense.aggregate({ _sum: { amount: true }, where }),
      db.expense.groupBy({ by: ["category"], _sum: { amount: true }, where }),
      db.expense.groupBy({ by: ["unit"], _sum: { amount: true }, _count: true, where }),
      db.monthlyFinance.findMany({
        // periodMonth UTC yarim tunda saqlanadi — mahalliy vaqt bilan
        // taqqoslasak UTC+5 da oy siljib ketadi
        where: { branchId, periodMonth: utcMonthStart(monthStart), ...unitFilter },
        orderBy: { unit: "asc" },
      }),
      db.debt.findMany({ where: { branchId }, orderBy: { createdAt: "asc" } }),
      db.expense.findMany({
        where: { branchId },
        select: { spentAt: true },
        orderBy: { spentAt: "desc" },
      }),
      // Moliyaviy xulosa bor, lekin harajat yozuvi yo'q oylar ham
      // ro'yxatda ko'rinishi kerak
      db.monthlyFinance.findMany({
        where: { branchId },
        select: { periodMonth: true },
        distinct: ["periodMonth"],
      }),
    ]);

  const catSum = (c: string) => num(byCat.find((b) => b.category === c)?._sum.amount);

  // Tovar puli ikki manbadan kelishi mumkin: F-Apteka kirimi (avtomatik) va
  // qo'lda kiritilgani. Ikkalasi bir oyda bo'lsa - ikki marta hisoblangan.
  const goodsAuto = list
    .filter((e) => e.category === "GOODS" && isFaptekaExpenseTitle(e.title))
    .reduce((sum, e) => sum + num(e.amount), 0);

  const byUnit = byUnitRows
    .map((r) => ({ unit: r.unit ?? "Umumiy", amount: num(r._sum.amount), count: r._count }))
    .sort((a, b) => b.amount - a.amount);
  const unitSpent = new Map(byUnit.map((u) => [u.unit, u.amount]));

  // Harajat sanalari + moliyaviy xulosa oylari birlashtiriladi, yangisi birinchi
  const monthKeys = new Set<string>([
    ...allDates.map((d) => `${d.spentAt.getFullYear()}-${d.spentAt.getMonth()}`),
    ...finMonths.map(
      (f) => `${f.periodMonth.getUTCFullYear()}-${f.periodMonth.getUTCMonth()}`,
    ),
  ]);
  const availableMonths = Array.from(monthKeys)
    .map((key) => {
      const [y, m] = key.split("-").map(Number);
      return new Date(y, m, 1);
    })
    .sort((a, b) => b.getTime() - a.getTime());

  // Doimiy xarajatlar: o'tgan oylarda bor, lekin shu oyda hali yo'q
  const recurringSources = await db.expense.findMany({
    where: { branchId, isRecurring: true, spentAt: { lt: monthStart } },
    orderBy: { spentAt: "desc" },
    take: 60,
  });
  const currentTitles = new Set(list.map((expense) => expense.title.trim().toLowerCase()));
  const missingRecurring: { id: string; title: string; category: string; amount: number; unit: string | null }[] = [];
  const seen = new Set<string>();
  for (const expense of recurringSources) {
    const key = expense.title.trim().toLowerCase();
    if (seen.has(key) || currentTitles.has(key)) continue;
    seen.add(key);
    missingRecurring.push({
      id: expense.id,
      title: expense.title,
      category: expense.category as string,
      amount: num(expense.amount),
      unit: expense.unit,
    });
  }

  return {
    period: monthStart,
    availableMonths,
    missingRecurring,
    list: list.map((e) => ({
      id: e.id,
      title: e.title,
      category: e.category,
      amount: num(e.amount),
      spentAt: e.spentAt,
      isRecurring: e.isRecurring,
      unit: e.unit,
    })),
    total: num(totalAgg._sum.amount),
    rent: catSum("RENT") + catSum("UTILITIES"),
    salary: catSum("SALARY"),
    goods: catSum("GOODS"),
    goodsAuto,
    goodsManual: catSum("GOODS") - goodsAuto,
    byCategory: byCat
      .map((c) => ({ category: c.category as string, amount: num(c._sum.amount) }))
      .sort((a, b) => b.amount - a.amount),
    byUnit,
    monthlyUnits: finRows.map((f) => {
      const spent = unitSpent.get(f.unit) ?? 0;
      const profit = num(f.profit);
      return {
        unit: f.unit,
        turnover: num(f.turnover),
        profit,
        expenses: spent,
        netProfit: profit - spent,
        stockValue: num(f.stockValue),
        revaluation: num(f.revaluation),
        bankBalance: f.bankBalance == null ? null : num(f.bankBalance),
        note: f.note,
      };
    }),
    debts: debtRows.map((q) => ({
      id: q.id,
      counterparty: q.counterparty,
      direction: q.direction as string,
      total: num(q.totalAmount),
      paid: num(q.paidAmount),
      remaining: num(q.totalAmount) - num(q.paidAmount),
      note: q.note,
    })),
  };
}

// ─────────────────────────────────────────────────────────────
//  XODIMLAR
// ─────────────────────────────────────────────────────────────
export async function getEmployeesData() {
  const now = new Date();
  const filial = await currentFilial();
  const employees = await db.employee.findMany({
    where: { ...unitWhere(filial) },
    orderBy: { createdAt: "asc" },
    include: {
      branch: true,
      kpiRecords: { where: { year: now.getFullYear(), month: now.getMonth() + 1 } },
    },
  });
  return employees.map((e) => ({
    id: e.id,
    fullName: e.fullName,
    position: e.position,
    branch: e.branch.name,
    unit: e.unit,
    baseSalary: num(e.baseSalary),
    status: e.status,
    kpi: e.kpiRecords[0]?.totalScore ?? null,
  }));
}

// ─────────────────────────────────────────────────────────────
//  KPI
// ─────────────────────────────────────────────────────────────
export async function getKpiData() {
  const now = new Date();
  const filial = await currentFilial();

  // Joriy oyda yozuv bo'lmasa — ma'lumot bor eng oxirgi oyni ko'rsatamiz
  const latest = await db.kpiRecord.findFirst({
    orderBy: [{ year: "desc" }, { month: "desc" }],
    select: { year: true, month: true },
  });
  const year = latest?.year ?? now.getFullYear();
  const month = latest?.month ?? now.getMonth() + 1;

  // Barcha faol xodimlar ro'yxatga kiradi — KPI hali kiritilmagan bo'lsa ham,
  // aks holda birinchi KPI ni kiritishning iloji bo'lmaydi.
  const [employees, records] = await Promise.all([
    db.employee.findMany({
      where: { status: "ACTIVE", ...unitWhere(filial) },
      orderBy: { fullName: "asc" },
    }),
    db.kpiRecord.findMany({ where: { year, month } }),
  ]);

  const byEmployee = new Map(records.map((r) => [r.employeeId, r]));

  const ranking = employees
    .map((e) => {
      const r = byEmployee.get(e.id);
      return {
        id: r?.id ?? `pending-${e.id}`,
        employeeId: e.id,
        name: e.fullName,
        position: e.position,
        unit: e.unit,
        baseSalary: num(e.baseSalary),
        hasRecord: Boolean(r),
        total: r?.totalScore ?? 0,
        bonusPercent: r?.bonusPercent ?? 0,
        bonusAmount: num(r?.bonusAmount),
        components: {
          sales: r?.salesScore ?? 0,
          margin: r?.marginScore ?? 0,
          attendance: r?.attendanceScore ?? 0,
          discipline: r?.disciplineScore ?? 0,
          customer: r?.customerScore ?? 0,
        },
      };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  const scored = ranking.filter((r) => r.hasRecord);
  const avg = scored.length
    ? Math.round((scored.reduce((s, r) => s + r.total, 0) / scored.length) * 10) / 10
    : 0;

  return {
    ranking,
    scoredCount: scored.length,
    avg,
    bonusFund: ranking.reduce((s, r) => s + r.bonusAmount, 0),
    over90: scored.filter((r) => r.total >= 90).length,
    under60: scored.filter((r) => r.total < 60).length,
    top: scored[0] ?? null,
    month,
    year,
  };
}

// ─────────────────────────────────────────────────────────────
//  DAVOMAT
// ─────────────────────────────────────────────────────────────
export async function getAttendanceData() {
  const today = startOfDay();
  const tomorrow = new Date(today.getTime() + 864e5);
  const monthStart = startOfMonth(0);

  const [employees, todayRecords, monthRecords] = await Promise.all([
    db.employee.findMany({ where: { status: { not: "INACTIVE" } }, orderBy: { createdAt: "asc" } }),
    db.attendance.findMany({ where: { date: { gte: today, lt: tomorrow } } }),
    db.attendance.findMany({ where: { date: { gte: monthStart } } }),
  ]);

  const byEmp = new Map(todayRecords.map((r) => [r.employeeId, r]));
  const records = employees.map((e) => {
    const r = byEmp.get(e.id);
    return {
      employeeId: e.id,
      name: e.fullName,
      checkIn: r?.checkIn ?? null,
      lateMinutes: r?.lateMinutes ?? 0,
      penalty: r?.penalty ?? 0,
      status: (r?.status as string | undefined) ?? null, // null = belgilanmagan
    };
  });

  const present = records.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
  const lateThisMonth = monthRecords.filter((r) => r.lateMinutes > 5).length;
  const checkIns = todayRecords.filter((r) => r.checkIn).map((r) => r.checkIn!);
  const avgCheckIn = checkIns.length
    ? new Date(checkIns.reduce((s, d) => s + d.getTime(), 0) / checkIns.length)
    : null;
  const perfect = monthRecords.filter((r) => r.status === "PRESENT" && r.lateMinutes === 0).length;
  const totalPenalty = monthRecords.reduce((s, r) => s + r.penalty, 0);

  return {
    records,
    presentCount: present,
    totalEmployees: employees.length,
    lateThisMonth,
    totalPenalty,
    avgCheckIn,
    perfect,
  };
}

// ─────────────────────────────────────────────────────────────
//  MIJOZLAR (sodiqlik)
// ─────────────────────────────────────────────────────────────
export async function getCustomersData() {
  const customers = await db.customer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      loyaltyTransactions: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  const list = customers.map((c) => ({
    id: c.id,
    fullName: c.fullName,
    phone: c.phone,
    cardCode: c.cardCode,
    points: c.points,
    tier: c.tier,
    totalSpent: num(c.totalSpent),
    viaTelegram: c.telegramId !== null,
    history: c.loyaltyTransactions.map((t) => ({
      id: t.id,
      type: t.type as string,
      points: t.points,
      note: t.note,
      createdAt: t.createdAt.toISOString(),
    })),
  }));

  return {
    list,
    total: list.length,
    viaTelegram: list.filter((c) => c.viaTelegram).length,
    totalPoints: list.reduce((s, c) => s + c.points, 0),
    gold: list.filter((c) => c.tier === "GOLD").length,
  };
}

// ─────────────────────────────────────────────────────────────
//  HISOBOTLAR — xodim/foyda korrelyatsiyasi
// ─────────────────────────────────────────────────────────────
export async function getReportsData() {
  const now = new Date();
  const monthStart = startOfMonth(0);

  const [marginRows, kpis, lowProducts] = await Promise.all([
    db.$queryRaw<{ id: string; name: string; margin: number }[]>`
      SELECT e.id, e."fullName" AS name,
        COALESCE(SUM(si."lineTotal" - si."costPrice" * si.quantity),0)::float8 AS margin
      FROM "Sale" s JOIN "Employee" e ON e.id = s."employeeId"
      JOIN "SaleItem" si ON si."saleId" = s.id
      WHERE s."createdAt" >= ${monthStart}
      GROUP BY e.id, e."fullName"`,
    db.kpiRecord.findMany({
      where: { year: now.getFullYear(), month: now.getMonth() + 1 },
      include: { employee: true },
    }),
    db.product.findMany({ where: { isActive: true } }),
  ]);

  const kpiMap = new Map(kpis.map((k) => [k.employeeId, k.totalScore]));
  const correlation = marginRows
    .map((r) => ({
      label: `${r.name.split(" ")[0]} (${kpiMap.get(r.id) ?? "-"})`,
      value: +M(r.margin).toFixed(1),
      kpi: kpiMap.get(r.id) ?? 0,
    }))
    .sort((a, b) => b.kpi - a.kpi);

  const critical = lowProducts.find((p) => p.stock < p.minStock * 0.4);

  return { correlation, critical: critical?.name ?? null };
}

// ─────────────────────────────────────────────────────────────
//  ANALITIKA — F-Apteka uslubidagi grafiklar
//  Manba: MonthlyFinance (savdo/foyda/astatka), Product (ombor),
//  Expense (harajat). Hammasi bor ma'lumotdan hisoblanadi.
// ─────────────────────────────────────────────────────────────
export async function getAnalyticsData(year?: number) {
  const branchId = await getBranchId();
  const y = year ?? new Date().getFullYear();
  const yearStart = new Date(Date.UTC(y, 0, 1));
  const yearEnd = new Date(Date.UTC(y + 1, 0, 1));

  // Savdo endi F-Apteka'dan keladi, shuning uchun yil kesimida tovar
  // tahlillarini ham hisoblaymiz (TOP savdo, sekin sotiladigan, vedomost).
  const salesFrom = yearStart;
  const salesTo = yearEnd;

  const [finRows, catRows, expRows, assortRows, topRows, stockRows, vedomostRows, dailyRows] = await Promise.all([
    // Oylik moliya — filial kesimida (Umumiy'ni chiqarib tashlaymiz, u taqsimlanmagan)
    db.monthlyFinance.findMany({
      where: { branchId, periodMonth: { gte: yearStart, lt: yearEnd } },
      orderBy: { periodMonth: "asc" },
    }),
    // Ombor qiymati — toifa bo'yicha (chakana narxda, jonli)
    db.$queryRaw<{ category: string; value: number; qty: number }[]>`
      SELECT p.category,
        COALESCE(SUM(p.stock * p."salePrice"), 0)::float8 AS value,
        COALESCE(SUM(p.stock), 0)::float8 AS qty
      FROM "Product" p
      WHERE p."isActive" = true AND p."branchId" = ${branchId} AND p.stock > 0
      GROUP BY p.category ORDER BY value DESC`,
    // Harajat — oy bo'yicha
    db.$queryRaw<{ m: Date; exp: number }[]>`
      SELECT date_trunc('month', e."spentAt") AS m, COALESCE(SUM(e.amount), 0)::float8 AS exp
      FROM "Expense" e WHERE e."branchId" = ${branchId}
        AND e."spentAt" >= ${yearStart} AND e."spentAt" < ${yearEnd}
      GROUP BY 1 ORDER BY 1`,
    // Assortiment — hozirgi qoldiq (eng qimmat 50 ta pozitsiya)
    db.$queryRaw<{ name: string; category: string; stock: number; price: number; value: number }[]>`
      SELECT p.name, p.category, p.stock::float8 AS stock, p."salePrice"::float8 AS price,
        (p.stock * p."salePrice")::float8 AS value
      FROM "Product" p
      WHERE p."isActive" = true AND p."branchId" = ${branchId} AND p.stock > 0
      ORDER BY value DESC LIMIT 50`,
    // TOP savdo — tushum bo'yicha
    db.$queryRaw<{ name: string; qty: number; turnover: number; profit: number }[]>`
      SELECT p.name,
        SUM(si.quantity)::float8 AS qty,
        SUM(si."lineTotal")::float8 AS turnover,
        SUM(si."lineTotal" - si."costPrice" * si.quantity)::float8 AS profit
      FROM "SaleItem" si
      JOIN "Sale" s ON s.id = si."saleId"
      JOIN "Product" p ON p.id = si."productId"
      WHERE s."branchId" = ${branchId} AND s."createdAt" >= ${salesFrom} AND s."createdAt" < ${salesTo}
      GROUP BY p.name ORDER BY turnover DESC LIMIT 50`,
    // Qoldig'i bor tovarlar: yil ichida qancha sotilgan (sekin sotiladigan va aylanuvchanlik uchun)
    db.$queryRaw<{ name: string; stock: number; value: number; qty: number }[]>`
      SELECT p.name, p.stock::float8 AS stock,
        (p.stock * p."salePrice")::float8 AS value,
        COALESCE((
          SELECT SUM(si.quantity) FROM "SaleItem" si JOIN "Sale" s ON s.id = si."saleId"
          WHERE si."productId" = p.id AND s."createdAt" >= ${salesFrom} AND s."createdAt" < ${salesTo}
        ), 0)::float8 AS qty
      FROM "Product" p
      WHERE p."isActive" = true AND p."branchId" = ${branchId} AND p.stock > 0
      ORDER BY value DESC LIMIT 400`,
    // Aylanma vedomost: kirim, sotuv, hozirgi qoldiq
    db.$queryRaw<{ name: string; incoming: number; sold: number; stock: number }[]>`
      SELECT p.name, p.stock::float8 AS stock,
        COALESCE((
          SELECT SUM(si.quantity) FROM "SaleItem" si JOIN "Sale" s ON s.id = si."saleId"
          WHERE si."productId" = p.id AND s."createdAt" >= ${salesFrom} AND s."createdAt" < ${salesTo}
        ), 0)::float8 AS sold,
        COALESCE((
          SELECT SUM(m.quantity) FROM "StockMovement" m
          WHERE m."productId" = p.id AND m.type = 'IN'
            AND m."createdAt" >= ${salesFrom} AND m."createdAt" < ${salesTo}
        ), 0)::float8 AS incoming
      FROM "Product" p
      WHERE p."isActive" = true AND p."branchId" = ${branchId}
      ORDER BY sold DESC LIMIT 50`,
    // Kunlik savdo — oxirgi 60 kun
    db.$queryRaw<{ day: Date; savdo: number; foyda: number }[]>`
      SELECT date_trunc('day', s."createdAt") AS day,
        SUM(si."lineTotal")::float8 AS savdo,
        SUM(si."lineTotal" - si."costPrice" * si.quantity)::float8 AS foyda
      FROM "SaleItem" si JOIN "Sale" s ON s.id = si."saleId"
      WHERE s."branchId" = ${branchId} AND s."createdAt" >= ${new Date(Date.now() - 60 * 864e5)}
      GROUP BY 1 ORDER BY 1`,
  ]);

  // Oy raqami -> harajat
  const expMap = new Map(expRows.map((r) => [new Date(r.m).getUTCMonth() + 1, M(r.exp)]));

  // Har oy uchun barcha filiallar yig'indisi (Umumiy'dan tashqari)
  const monthAgg = new Map<number, { savdo: number; foyda: number; astatka: number }>();
  for (const row of finRows) {
    if (row.unit === "Umumiy") continue;
    const m = new Date(row.periodMonth).getUTCMonth() + 1;
    const cur = monthAgg.get(m) ?? { savdo: 0, foyda: 0, astatka: 0 };
    cur.savdo += num(row.turnover) / 1_000_000;
    cur.foyda += num(row.profit) / 1_000_000;
    cur.astatka += num(row.stockValue) / 1_000_000;
    monthAgg.set(m, cur);
  }

  // 12 oylik dinamika — ma'lumot bor oylargacha
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const a = monthAgg.get(m);
    return {
      month: m,
      label: monthName(m).slice(0, 3),
      savdo: +(a?.savdo ?? 0).toFixed(1),
      foyda: +(a?.foyda ?? 0).toFixed(1),
      astatka: +(a?.astatka ?? 0).toFixed(1),
      xarajat: +(expMap.get(m) ?? 0).toFixed(1),
    };
  }).filter((r) => r.savdo > 0 || r.foyda > 0 || r.astatka > 0 || r.xarajat > 0);

  // Eng oxirgi ma'lumot bor oy — filiallar taqqoslashi uchun
  const lastMonth = finRows
    .filter((r) => r.unit !== "Umumiy")
    .reduce((max, r) => {
      const m = new Date(r.periodMonth).getUTCMonth() + 1;
      return m > max ? m : max;
    }, 0);

  const byUnit = finRows
    .filter((r) => r.unit !== "Umumiy" && new Date(r.periodMonth).getUTCMonth() + 1 === lastMonth)
    .map((r) => ({
      unit: r.unit,
      savdo: +(num(r.turnover) / 1_000_000).toFixed(1),
      foyda: +(num(r.profit) / 1_000_000).toFixed(1),
      astatka: +(num(r.stockValue) / 1_000_000).toFixed(1),
    }))
    .sort((a, b) => b.savdo - a.savdo);

  // Ombor qiymati toifa bo'yicha (top 6 + boshqa), mln so'm
  const totalCat = catRows.reduce((s, r) => s + r.value, 0);
  const topCats = catRows.slice(0, 6).map((r) => ({
    name: r.category,
    value: +M(r.value).toFixed(1),
  }));
  const restCat = catRows.slice(6).reduce((s, r) => s + r.value, 0);
  const inventoryByCategory =
    restCat > 0 ? [...topCats, { name: "Boshqa", value: +M(restCat).toFixed(1) }] : topCats;

  return {
    year: y,
    monthly, // { label, savdo, foyda, astatka, xarajat }[]
    byUnit, // oxirgi oy filiallar kesimi
    lastMonthName: lastMonth ? monthName(lastMonth) : null,
    inventoryByCategory, // ombor qiymati toifa bo'yicha (mln)
    inventoryTotal: +M(totalCat).toFixed(1),
    hasFinance: monthly.length > 0,
    hasInventory: inventoryByCategory.length > 0,
    // Assortiment (sana holatiga) — hozirgi qoldiq
    assortment: assortRows.map((r) => ({
      name: r.name,
      category: r.category,
      stock: Math.round(r.stock),
      price: Math.round(r.price),
      value: +M(r.value).toFixed(2),
    })),
    // TOP savdo — yil bo'yicha eng ko'p tushum keltirgan tovarlar
    topProducts: topRows.map((r) => ({
      name: r.name,
      qty: Math.round(r.qty),
      turnover: +M(r.turnover).toFixed(2),
      profit: +M(r.profit).toFixed(2),
    })),
    // Sekin sotiladigan: qoldig'i bor, lekin yil davomida kam sotilgan
    slowMovers: [...stockRows]
      .sort((a, b) => a.qty - b.qty || b.value - a.value)
      .slice(0, 50)
      .map((r) => ({
        name: r.name,
        stock: Math.round(r.stock),
        qty: Math.round(r.qty),
        value: +M(r.value).toFixed(2),
      })),
    // Aylanuvchanlik: yil savdosi qoldiqqa nisbatan necha marta aylangan
    turnoverRatio: stockRows
      .filter((r) => r.qty > 0 && r.stock > 0)
      .map((r) => ({
        name: r.name,
        stock: Math.round(r.stock),
        qty: Math.round(r.qty),
        ratio: +(r.qty / r.stock).toFixed(2),
      }))
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 50),
    // Aylanma vedomost: kirim, sotuv, hozirgi qoldiq
    vedomost: vedomostRows.map((r) => ({
      name: r.name,
      incoming: Math.round(r.incoming),
      sold: Math.round(r.sold),
      stock: Math.round(r.stock),
    })),
    // Kunlik savdo — oxirgi 60 kun (mln so'm)
    dailySales: dailyRows.map((r) => {
      const day = new Date(r.day);
      return {
        label: `${String(day.getDate()).padStart(2, "0")}.${String(day.getMonth() + 1).padStart(2, "0")}`,
        savdo: +M(r.savdo).toFixed(2),
        foyda: +M(r.foyda).toFixed(2),
      };
    }),
  };
}

// ─────────────────────────────────────────────────────────────
//  SAVDO — F-Apteka'dan kelgan sotuvlar
// ─────────────────────────────────────────────────────────────

/**
 * Sana oralig'idagi savdo: kunlik jadval, dorixona kesimi va eng ko'p
 * sotilgan tovarlar.
 *
 * F-Apteka 4-hisoboti chekma-chek emas, kunlik jamlanma beradi — shuning
 * uchun "chek soni" ko'rsatilmaydi, faqat tushum, foyda va marja.
 */
export async function getSalesData(input: { from: Date; to: Date }) {
  const branchId = await getBranchId();
  const filial = await currentFilial();
  const unit = filial === "Umumiy" ? null : filial;
  // `to` — tanlangan kunning o'zi ham kirsin
  const toExclusive = new Date(input.to.getFullYear(), input.to.getMonth(), input.to.getDate() + 1);

  const [dailyRows, unitRows, productRows] = await Promise.all([
    db.$queryRaw<{ day: Date; turnover: number; profit: number }[]>`
      SELECT date_trunc('day', s."createdAt") AS day,
             SUM(si."lineTotal")::float8 AS turnover,
             SUM(si."lineTotal" - si."costPrice" * si.quantity)::float8 AS profit
      FROM "SaleItem" si JOIN "Sale" s ON s.id = si."saleId"
      WHERE s."branchId" = ${branchId}
        AND s."createdAt" >= ${input.from} AND s."createdAt" < ${toExclusive}
        AND (${unit}::text IS NULL OR s."unit" = ${unit})
      GROUP BY 1 ORDER BY 1 DESC`,
    db.$queryRaw<{ unit: string | null; turnover: number; profit: number }[]>`
      SELECT s."unit" AS unit,
             SUM(si."lineTotal")::float8 AS turnover,
             SUM(si."lineTotal" - si."costPrice" * si.quantity)::float8 AS profit
      FROM "SaleItem" si JOIN "Sale" s ON s.id = si."saleId"
      WHERE s."branchId" = ${branchId}
        AND s."createdAt" >= ${input.from} AND s."createdAt" < ${toExclusive}
        AND (${unit}::text IS NULL OR s."unit" = ${unit})
      GROUP BY 1 ORDER BY 2 DESC`,
    db.$queryRaw<{ name: string; quantity: number; turnover: number; profit: number }[]>`
      SELECT p.name AS name,
             SUM(si.quantity)::float8 AS quantity,
             SUM(si."lineTotal")::float8 AS turnover,
             SUM(si."lineTotal" - si."costPrice" * si.quantity)::float8 AS profit
      FROM "SaleItem" si
      JOIN "Sale" s ON s.id = si."saleId"
      JOIN "Product" p ON p.id = si."productId"
      WHERE s."branchId" = ${branchId}
        AND s."createdAt" >= ${input.from} AND s."createdAt" < ${toExclusive}
        AND (${unit}::text IS NULL OR s."unit" = ${unit})
      GROUP BY 1 ORDER BY 3 DESC LIMIT 25`,
  ]);

  // Kunlik naqd/terminal — F-Apteka hujjat turidan (DailySales)
  const groups = docTypeGroups();
  let paymentRows: { day: Date; docType: string; amount: unknown }[] = [];
  try {
    paymentRows = await db.dailySales.findMany({
      where: { day: { gte: input.from, lt: toExclusive }, ...(unit ? { unit } : {}) },
      select: { day: true, docType: true, amount: true },
    });
  } catch {
    // Jadval hali yaratilmagan bo'lsa ustunlar bo'sh qoladi
  }

  const payments = new Map<string, { cash: number; card: number }>();
  for (const row of paymentRows) {
    const key = new Date(row.day).toISOString().slice(0, 10);
    const current = payments.get(key) ?? { cash: 0, card: 0 };
    const amount = num(row.amount);
    if (groups.cash.has(row.docType)) current.cash += amount;
    else if (groups.card.has(row.docType)) current.card += amount;
    payments.set(key, current);
  }

  const daily = dailyRows.map((row) => {
    const day = new Date(row.day);
    const payment = payments.get(day.toISOString().slice(0, 10));
    return {
      day,
      turnover: num(row.turnover),
      profit: num(row.profit),
      cash: payment?.cash ?? 0,
      card: payment?.card ?? 0,
    };
  });
  const turnover = daily.reduce((sum, row) => sum + row.turnover, 0);
  const profit = daily.reduce((sum, row) => sum + row.profit, 0);

  return {
    filial,
    daily,
    turnover,
    profit,
    cashTotal: daily.reduce((sum, row) => sum + row.cash, 0),
    cardTotal: daily.reduce((sum, row) => sum + row.card, 0),
    hasPayments: paymentRows.length > 0,
    // Tan narx hali kelmagan bo'lsa foyda tushumga teng bo'lib qoladi —
    // sahifa shunda ogohlantirish ko'rsatadi.
    costMissing: turnover > 0 && profit >= turnover - 0.5,
    byUnit: unitRows.map((row) => ({
      unit: row.unit ?? "Ajratilmagan",
      turnover: num(row.turnover),
      profit: num(row.profit),
    })),
    products: productRows.map((row) => ({
      name: row.name,
      quantity: num(row.quantity),
      turnover: num(row.turnover),
      profit: num(row.profit),
    })),
  };
}

// ─────────────────────────────────────────────────────────────
//  QARZLAR
// ─────────────────────────────────────────────────────────────

/** Muddati shu kun ichida bo'lsa "yaqin" deb sanaladi */
export const DEBT_DUE_SOON_DAYS = 5;

/**
 * Qarzlar: firma (tovar) va ko'cha (naqd) kesimida, tarixi bilan.
 * Qoldiq tarixdan hisoblanadi, shuning uchun "shuncha berildi, shuncha
 * qoldi" har doim to'g'ri chiqadi.
 */
export async function getDebtsData() {
  const branchId = await getBranchId();

  // Jadval hali yaratilmagan bo'lsa (qarzlar.sql ishga tushirilmagan),
  // sahifa xato bermasin — bo'sh ro'yxat va ogohlantirish qaytaramiz.
  type DebtWithEntries = Prisma.DebtGetPayload<{ include: { entries: true } }>;
  let rows: DebtWithEntries[] = [];
  let needsMigration = false;
  try {
    rows = await db.debt.findMany({
      where: { branchId },
      orderBy: [{ closedAt: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      include: { entries: { orderBy: { happenedAt: "desc" } } },
    });
  } catch {
    needsMigration = true;
  }

  const today = startOfDay();
  const soonEdge = new Date(today.getTime() + DEBT_DUE_SOON_DAYS * 864e5);

  const debts = rows.map((debt) => {
    const total = num(debt.totalAmount);
    const paid = num(debt.paidAmount);
    const remaining = total - paid;
    const due = debt.dueDate ? new Date(debt.dueDate) : null;
    const closed = Boolean(debt.closedAt) || remaining <= 0.009;

    return {
      id: debt.id,
      counterparty: debt.counterparty,
      kind: debt.kind as "FIRM" | "STREET",
      currency: debt.currency as "UZS" | "USD",
      direction: debt.direction as "PAYABLE" | "RECEIVABLE",
      total,
      paid,
      remaining,
      dueDate: due,
      closed,
      // Rang uchun: muddati o'tgan / yaqin / vaqti bor
      overdue: !closed && due !== null && due < today,
      dueSoon: !closed && due !== null && due >= today && due <= soonEdge,
      unit: debt.unit,
      note: debt.note,
      entries: debt.entries.map((entry) => ({
        id: entry.id,
        type: entry.type as "CHARGE" | "PAYMENT",
        amount: num(entry.amount),
        happenedAt: entry.happenedAt,
        note: entry.note,
      })),
    };
  });

  const open = debts.filter((debt) => !debt.closed);
  const sumBy = (kind: "FIRM" | "STREET", currency: "UZS" | "USD") =>
    open
      .filter((debt) => debt.kind === kind && debt.currency === currency)
      .reduce((sum, debt) => sum + debt.remaining, 0);

  return {
    needsMigration,
    debts,
    totals: {
      firmUzs: sumBy("FIRM", "UZS"),
      firmUsd: sumBy("FIRM", "USD"),
      streetUzs: sumBy("STREET", "UZS"),
      streetUsd: sumBy("STREET", "USD"),
    },
    overdue: open.filter((debt) => debt.overdue),
    dueSoon: open.filter((debt) => debt.dueSoon),
    openCount: open.length,
  };
}

// ─────────────────────────────────────────────────────────────
//  BOSH SAHIFA (dashboard)
// ─────────────────────────────────────────────────────────────

/** Saytga kirganda ko'rinadigan umumiy holat — hamma bo'limdan qisqacha */
export async function getDashboardData() {
  const branchId = await getBranchId();
  const filial = await currentFilial();
  const unit = filial === "Umumiy" ? null : filial;

  const today = startOfDay();
  const tomorrow = new Date(today.getTime() + 864e5);
  const yesterday = new Date(today.getTime() - 864e5);
  const monthStart = startOfMonth(0);
  const nextMonth = startOfMonth(1);
  const in30 = new Date(today.getTime() + 30 * 864e5);

  const [todayRows, yesterdayRows, monthRows, stock, lowStock, expiring, lastSync] = await Promise.all([
    db.$queryRaw<{ turnover: number }[]>`
      SELECT COALESCE(SUM(si."lineTotal"), 0)::float8 AS turnover
      FROM "SaleItem" si JOIN "Sale" s ON s.id = si."saleId"
      WHERE s."branchId" = ${branchId} AND s."createdAt" >= ${today} AND s."createdAt" < ${tomorrow}
        AND (${unit}::text IS NULL OR s."unit" = ${unit})`,
    db.$queryRaw<{ turnover: number }[]>`
      SELECT COALESCE(SUM(si."lineTotal"), 0)::float8 AS turnover
      FROM "SaleItem" si JOIN "Sale" s ON s.id = si."saleId"
      WHERE s."branchId" = ${branchId} AND s."createdAt" >= ${yesterday} AND s."createdAt" < ${today}
        AND (${unit}::text IS NULL OR s."unit" = ${unit})`,
    db.$queryRaw<{ turnover: number; profit: number }[]>`
      SELECT COALESCE(SUM(si."lineTotal"), 0)::float8 AS turnover,
             COALESCE(SUM(si."lineTotal" - si."costPrice" * si.quantity), 0)::float8 AS profit
      FROM "SaleItem" si JOIN "Sale" s ON s.id = si."saleId"
      WHERE s."branchId" = ${branchId} AND s."createdAt" >= ${monthStart} AND s."createdAt" < ${nextMonth}
        AND (${unit}::text IS NULL OR s."unit" = ${unit})`,
    db.$queryRaw<{ value: number; positions: number }[]>`
      SELECT COALESCE(SUM(p.stock * p."salePrice"), 0)::float8 AS value,
             COUNT(*)::float8 AS positions
      FROM "Product" p
      WHERE p."isActive" = true AND p."branchId" = ${branchId} AND p.stock > 0`,
    db.product.findMany({
      where: { isActive: true, branchId, stock: { lte: 3 } },
      orderBy: { stock: "asc" },
      take: 6,
      select: { id: true, name: true, stock: true },
    }),
    db.product.findMany({
      where: { isActive: true, branchId, stock: { gt: 0 }, expiryDate: { not: null, lte: in30 } },
      orderBy: { expiryDate: "asc" },
      take: 6,
      select: { id: true, name: true, stock: true, expiryDate: true },
    }),
    db.integrationLog
      .findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true, source: true, note: true } })
      .catch(() => null),
  ]);

  const todaySales = num(todayRows[0]?.turnover);
  const yesterdaySales = num(yesterdayRows[0]?.turnover);

  return {
    filial,
    todaySales,
    yesterdaySales,
    todayTrend: yesterdaySales > 0 ? ((todaySales - yesterdaySales) / yesterdaySales) * 100 : 0,
    monthTurnover: num(monthRows[0]?.turnover),
    monthProfit: num(monthRows[0]?.profit),
    stockValue: num(stock[0]?.value),
    stockPositions: Math.round(num(stock[0]?.positions)),
    lowStock: lowStock.map((p) => ({ id: p.id, name: p.name, stock: p.stock })),
    expiring: expiring.map((p) => ({
      id: p.id,
      name: p.name,
      stock: p.stock,
      expiryDate: p.expiryDate as Date,
    })),
    lastSync: lastSync ? { at: lastSync.createdAt, source: lastSync.source, note: lastSync.note } : null,
  };
}
