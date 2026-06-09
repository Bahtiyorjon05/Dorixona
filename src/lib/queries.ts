import { db } from "@/lib/db";
import { monthName } from "@/lib/format";

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
    db.sale.aggregate({ _sum: { total: true }, where: { createdAt: { gte: today, lt: tomorrow } } }),
    db.sale.aggregate({ _sum: { total: true }, where: { createdAt: { gte: yesterday, lt: today } } }),
    db.$queryRaw<{ margin: number }[]>`
      SELECT COALESCE(SUM(si."lineTotal" - si."costPrice" * si.quantity), 0)::float8 AS margin
      FROM "SaleItem" si JOIN "Sale" s ON s.id = si."saleId"
      WHERE s."createdAt" >= ${monthStart} AND s."createdAt" < ${nextMonth}`,
    db.$queryRaw<{ margin: number }[]>`
      SELECT COALESCE(SUM(si."lineTotal" - si."costPrice" * si.quantity), 0)::float8 AS margin
      FROM "SaleItem" si JOIN "Sale" s ON s.id = si."saleId"
      WHERE s."createdAt" >= ${lastMonthStart} AND s."createdAt" < ${monthStart}`,
    db.$queryRaw<{ method: string; sum: number }[]>`
      SELECT s."paymentMethod"::text AS method, COALESCE(SUM(s.total),0)::float8 AS sum
      FROM "Sale" s WHERE s."createdAt" >= ${monthStart} AND s."createdAt" < ${nextMonth}
      GROUP BY 1`,
    db.$queryRaw<{ value: number }[]>`
      SELECT COALESCE(SUM(stock * "costPrice"),0)::float8 AS value FROM "Product" WHERE "isActive" = true`,
    db.$queryRaw<{ d: Date; total: number }[]>`
      SELECT date_trunc('day', s."createdAt") AS d, COALESCE(SUM(s.total),0)::float8 AS total
      FROM "Sale" s WHERE s."createdAt" >= ${weekAgo}
      GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ category: string; revenue: number }[]>`
      SELECT p.category, COALESCE(SUM(si."lineTotal"),0)::float8 AS revenue
      FROM "SaleItem" si JOIN "Sale" s ON s.id = si."saleId" JOIN "Product" p ON p.id = si."productId"
      WHERE s."createdAt" >= ${monthStart} GROUP BY p.category ORDER BY revenue DESC`,
    db.$queryRaw<{ m: Date; rev: number }[]>`
      SELECT date_trunc('month', s."createdAt") AS m, COALESCE(SUM(s.total),0)::float8 AS rev
      FROM "Sale" s WHERE s."createdAt" >= ${sixMonthsAgo}
      GROUP BY 1 ORDER BY 1`,
  ]);

  const expenseSeries = await db.$queryRaw<{ m: Date; exp: number }[]>`
    SELECT date_trunc('month', e."spentAt") AS m, COALESCE(SUM(e.amount),0)::float8 AS exp
    FROM "Expense" e WHERE e."spentAt" >= ${sixMonthsAgo}
    GROUP BY 1 ORDER BY 1`;

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
  const in30 = new Date(Date.now() + 30 * 864e5);
  const [products, totalCount, valueRow] = await Promise.all([
    db.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    db.product.count({ where: { isActive: true } }),
    db.$queryRaw<{ value: number }[]>`
      SELECT COALESCE(SUM(stock * "costPrice"),0)::float8 AS value FROM "Product" WHERE "isActive" = true`,
  ]);

  const lowStock = products.filter((p) => p.stock < p.minStock).length;
  const expiring = products.filter((p) => p.expiryDate && p.expiryDate <= in30).length;

  return {
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      stock: p.stock,
      minStock: p.minStock,
      salePrice: num(p.salePrice),
      status: stockStatus(p.stock, p.minStock),
    })),
    totalCount,
    lowStock,
    expiring,
    inventoryValue: num(valueRow[0]?.value),
  };
}

// ─────────────────────────────────────────────────────────────
//  HARAJATLAR
// ─────────────────────────────────────────────────────────────
export async function getExpensesData() {
  const monthStart = startOfMonth(0);
  const nextMonth = startOfMonth(1);
  const where = { spentAt: { gte: monthStart, lt: nextMonth } };

  const [list, totalAgg, byCat] = await Promise.all([
    db.expense.findMany({ where, orderBy: { spentAt: "desc" } }),
    db.expense.aggregate({ _sum: { amount: true }, where }),
    db.expense.groupBy({ by: ["category"], _sum: { amount: true }, where }),
  ]);

  const catSum = (c: string) => num(byCat.find((b) => b.category === c)?._sum.amount);

  return {
    list: list.map((e) => ({
      id: e.id,
      title: e.title,
      category: e.category,
      amount: num(e.amount),
      spentAt: e.spentAt,
      isRecurring: e.isRecurring,
    })),
    total: num(totalAgg._sum.amount),
    rent: catSum("RENT") + catSum("UTILITIES"),
    salary: catSum("SALARY"),
    goods: catSum("GOODS"),
  };
}

// ─────────────────────────────────────────────────────────────
//  XODIMLAR
// ─────────────────────────────────────────────────────────────
export async function getEmployeesData() {
  const now = new Date();
  const employees = await db.employee.findMany({
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
  const records = await db.kpiRecord.findMany({
    where: { year: now.getFullYear(), month: now.getMonth() + 1 },
    include: { employee: true },
    orderBy: { totalScore: "desc" },
  });

  const ranking = records.map((r) => ({
    id: r.id,
    name: r.employee.fullName,
    position: r.employee.position,
    baseSalary: num(r.employee.baseSalary),
    total: r.totalScore,
    bonusPercent: r.bonusPercent,
    bonusAmount: num(r.bonusAmount),
    components: {
      sales: r.salesScore,
      margin: r.marginScore,
      attendance: r.attendanceScore,
      discipline: r.disciplineScore,
      customer: r.customerScore,
    },
  }));

  const avg = ranking.length
    ? Math.round((ranking.reduce((s, r) => s + r.total, 0) / ranking.length) * 10) / 10
    : 0;

  return {
    ranking,
    avg,
    bonusFund: ranking.reduce((s, r) => s + r.bonusAmount, 0),
    over90: ranking.filter((r) => r.total >= 90).length,
    under60: ranking.filter((r) => r.total < 60).length,
    top: ranking[0] ?? null,
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
}

// ─────────────────────────────────────────────────────────────
//  DAVOMAT
// ─────────────────────────────────────────────────────────────
export async function getAttendanceData() {
  const today = startOfDay();
  const tomorrow = new Date(today.getTime() + 864e5);
  const monthStart = startOfMonth(0);

  const [todayRecords, monthRecords] = await Promise.all([
    db.attendance.findMany({
      where: { date: { gte: today, lt: tomorrow } },
      include: { employee: true },
      orderBy: { employee: { createdAt: "asc" } },
    }),
    db.attendance.findMany({ where: { date: { gte: monthStart } } }),
  ]);

  const present = todayRecords.filter((r) => r.status !== "ON_LEAVE" && r.status !== "ABSENT").length;
  const lateThisMonth = monthRecords.filter((r) => r.lateMinutes > 5).length;
  const checkIns = todayRecords.filter((r) => r.checkIn).map((r) => r.checkIn!);
  const avgCheckIn = checkIns.length
    ? new Date(checkIns.reduce((s, d) => s + d.getTime(), 0) / checkIns.length)
    : null;
  const perfect = monthRecords.filter((r) => r.status === "PRESENT" && r.lateMinutes === 0).length;
  const totalPenalty = monthRecords.reduce((s, r) => s + r.penalty, 0);

  return {
    records: todayRecords.map((r) => ({
      id: r.id,
      name: r.employee.fullName,
      checkIn: r.checkIn,
      lateMinutes: r.lateMinutes,
      penalty: r.penalty,
      status: r.status,
    })),
    presentCount: present,
    totalEmployees: todayRecords.length,
    lateThisMonth,
    totalPenalty,
    avgCheckIn,
    perfect,
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
