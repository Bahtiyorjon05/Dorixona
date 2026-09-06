import { auth } from "@/auth";
import { db } from "@/lib/db";
import { activeBranch } from "@/lib/actions/_shared";
import { monthName } from "@/lib/format";
import { isFaptekaSku } from "@/lib/integrations/fapteka/mapping";
import { unitWhere } from "@/lib/filial";
import { currentFilial } from "@/lib/filial-server";

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
const M = (v: unknown) => num(v) / 1_000_000; // mln so'm

// ─────────────────────────────────────────────────────────────
//  MOLIYA
// ─────────────────────────────────────────────────────────────
export async function getFinanceData() {
  const branchId = await getBranchId();
  const today = startOfDay();
  const tomorrow = new Date(today.getTime() + 864e5);
  const yesterday = new Date(today.getTime() - 864e5);
  const monthStart = startOfMonth(0);
  const nextMonth = startOfMonth(1);
  const lastMonthStart = startOfMonth(-1);
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

  const cash = payAgg.find((p) => p.method === "CASH")?.sum ?? 0;
  const card = payAgg.find((p) => p.method === "CARD")?.sum ?? 0;
  const mixed = payAgg.find((p) => p.method === "MIXED")?.sum ?? 0;

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
    const currentCount = await db.expense.count({
      where: { branchId, spentAt: { gte: current, lt: startOfMonth(1) } },
    });
    if (currentCount > 0) {
      monthStart = current;
    } else {
      const last = await db.expense.findFirst({
        where: { branchId },
        orderBy: { spentAt: "desc" },
        select: { spentAt: true },
      });
      monthStart = last
        ? new Date(last.spentAt.getFullYear(), last.spentAt.getMonth(), 1)
        : current;
    }
  }
  const nextMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
  const filial = await currentFilial();
  const unitFilter = unitWhere(filial);
  const where = { branchId, spentAt: { gte: monthStart, lt: nextMonth }, ...unitFilter };

  const [list, totalAgg, byCat, byUnitRows, finRows, debtRows, allDates] =
    await Promise.all([
      db.expense.findMany({ where, orderBy: { spentAt: "desc" } }),
      db.expense.aggregate({ _sum: { amount: true }, where }),
      db.expense.groupBy({ by: ["category"], _sum: { amount: true }, where }),
      db.expense.groupBy({ by: ["unit"], _sum: { amount: true }, _count: true, where }),
      db.monthlyFinance.findMany({
        where: { branchId, periodMonth: monthStart, ...unitFilter },
        orderBy: { unit: "asc" },
      }),
      db.debt.findMany({ where: { branchId }, orderBy: { createdAt: "asc" } }),
      db.expense.findMany({
        where: { branchId },
        select: { spentAt: true },
        orderBy: { spentAt: "desc" },
      }),
    ]);

  const catSum = (c: string) => num(byCat.find((b) => b.category === c)?._sum.amount);

  const byUnit = byUnitRows
    .map((r) => ({ unit: r.unit ?? "Umumiy", amount: num(r._sum.amount), count: r._count }))
    .sort((a, b) => b.amount - a.amount);
  const unitSpent = new Map(byUnit.map((u) => [u.unit, u.amount]));

  const availableMonths = Array.from(
    new Set(allDates.map((d) => `${d.spentAt.getFullYear()}-${d.spentAt.getMonth()}`)),
  ).map((key) => {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m, 1);
  });

  return {
    period: monthStart,
    availableMonths,
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
