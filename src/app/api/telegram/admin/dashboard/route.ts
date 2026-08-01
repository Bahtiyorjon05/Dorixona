import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { canRead, type RequestAccess, verifyRequestAccess } from "@/lib/request-access";
import type { AppPermission } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const num = (value: unknown) => Number(value ?? 0);
const M = (value: unknown) => num(value) / 1_000_000;

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(offset = 0, base = new Date()) {
  return new Date(base.getFullYear(), base.getMonth() + offset, 1);
}

async function getFinance() {
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
    expenseSeries,
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
    db.$queryRaw<{ m: Date; exp: number }[]>`
      SELECT date_trunc('month', e."spentAt") AS m, COALESCE(SUM(e.amount),0)::float8 AS exp
      FROM "Expense" e WHERE e."spentAt" >= ${sixMonthsAgo}
      GROUP BY 1 ORDER BY 1`,
  ]);

  const cash = payAgg.find((row) => row.method === "CASH")?.sum ?? 0;
  const card = payAgg.find((row) => row.method === "CARD")?.sum ?? 0;
  const mixed = payAgg.find((row) => row.method === "MIXED")?.sum ?? 0;
  const todaySales = num(todayAgg._sum.total);
  const yesterdaySales = num(yesterdayAgg._sum.total) || 1;
  const margin = num(monthMargin[0]?.margin);
  const lastMargin = num(lastMonthMargin[0]?.margin) || 1;

  const totalCat = catRows.reduce((sum, row) => sum + row.revenue, 0) || 1;
  const categories = catRows.slice(0, 5).map((row) => ({
    name: row.category,
    revenue: row.revenue,
    percent: Math.round((row.revenue / totalCat) * 100),
  }));

  const weekdays = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Sha"];
  const weekMap = new Map(weekRows.map((row) => [startOfDay(new Date(row.d)).getTime(), M(row.total)]));
  const weekSales = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(today.getTime() - (6 - i) * 864e5);
    return {
      label: weekdays[day.getDay()],
      value: +(weekMap.get(day.getTime()) ?? 0).toFixed(2),
    };
  });

  const expMap = new Map(expenseSeries.map((row) => [new Date(row.m).getTime(), M(row.exp)]));
  const sixMonths = Array.from({ length: 6 }, (_, i) => {
    const month = startOfMonth(-5 + i);
    const rev = seriesRows.find((row) => new Date(row.m).getTime() === month.getTime());
    return {
      label: month.toLocaleDateString("uz-UZ", { month: "short" }),
      savdo: +(rev ? M(rev.rev) : 0).toFixed(1),
      xarajat: +(expMap.get(month.getTime()) ?? 0).toFixed(1),
    };
  });

  return {
    todaySales,
    todayTrend: ((todaySales - yesterdaySales) / yesterdaySales) * 100,
    monthlyProfit: margin,
    profitTrend: ((margin - lastMargin) / lastMargin) * 100,
    cashTotal: cash + card + mixed,
    cash,
    card,
    mixed,
    inventoryValue: num(invValue[0]?.value),
    weekSales,
    categories,
    sixMonths,
  };
}

async function getSales() {
  const today = startOfDay();
  const tomorrow = new Date(today.getTime() + 864e5);
  const [todayAgg, todayCount, recent] = await Promise.all([
    db.sale.aggregate({ _sum: { total: true }, where: { createdAt: { gte: today, lt: tomorrow } } }),
    db.sale.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
    db.sale.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        customer: { select: { fullName: true, phone: true } },
        employee: { select: { fullName: true } },
        items: { select: { id: true } },
      },
    }),
  ]);

  return {
    todayTotal: num(todayAgg._sum.total),
    todayCount,
    recent: recent.map((sale) => ({
      id: sale.id,
      receiptNo: sale.receiptNo,
      total: num(sale.total),
      paymentMethod: sale.paymentMethod,
      createdAt: sale.createdAt.toISOString(),
      customer: sale.customer?.fullName ?? sale.customer?.phone ?? "Mijozsiz",
      employee: sale.employee?.fullName ?? "Xodim yo'q",
      itemCount: sale.items.length,
    })),
  };
}

async function getInventory() {
  const in30 = new Date(Date.now() + 30 * 864e5);
  const products = await db.product.findMany({
    where: { isActive: true },
    orderBy: [{ stock: "asc" }, { name: "asc" }],
  });

  const lowStock = products.filter((product) => product.stock < product.minStock);
  const expiring = products.filter((product) => product.expiryDate && product.expiryDate <= in30);
  const inventoryValue = products.reduce((sum, product) => sum + product.stock * Number(product.costPrice), 0);

  return {
    totalCount: products.length,
    inventoryValue,
    lowStockCount: lowStock.length,
    expiringCount: expiring.length,
    lowStock: lowStock.slice(0, 8).map((product) => ({
      id: product.id,
      name: product.name,
      stock: product.stock,
      minStock: product.minStock,
      category: product.category,
    })),
    expiring: expiring.slice(0, 8).map((product) => ({
      id: product.id,
      name: product.name,
      expiryDate: product.expiryDate?.toISOString() ?? null,
    })),
  };
}

async function getExpenses() {
  const monthStart = startOfMonth(0);
  const nextMonth = startOfMonth(1);
  const where = { spentAt: { gte: monthStart, lt: nextMonth } };
  const [list, totalAgg, byCat] = await Promise.all([
    db.expense.findMany({ where, orderBy: { spentAt: "desc" }, take: 8 }),
    db.expense.aggregate({ _sum: { amount: true }, where }),
    db.expense.groupBy({ by: ["category"], _sum: { amount: true }, where }),
  ]);

  return {
    total: num(totalAgg._sum.amount),
    categories: byCat.map((row) => ({
      category: row.category,
      amount: num(row._sum.amount),
    })),
    recent: list.map((expense) => ({
      id: expense.id,
      title: expense.title,
      category: expense.category,
      amount: num(expense.amount),
      spentAt: expense.spentAt.toISOString(),
      isRecurring: expense.isRecurring,
    })),
  };
}

async function getCustomers() {
  const [customers, recent] = await Promise.all([
    db.customer.findMany({ orderBy: { totalSpent: "desc" }, take: 8 }),
    db.customer.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
  ]);
  const all = await db.customer.findMany({ select: { tier: true, points: true, telegramId: true } });

  return {
    total: all.length,
    viaTelegram: all.filter((customer) => customer.telegramId !== null).length,
    totalPoints: all.reduce((sum, customer) => sum + customer.points, 0),
    tiers: {
      bronze: all.filter((customer) => customer.tier === "BRONZE").length,
      silver: all.filter((customer) => customer.tier === "SILVER").length,
      gold: all.filter((customer) => customer.tier === "GOLD").length,
    },
    top: customers.map((customer) => ({
      id: customer.id,
      name: customer.fullName ?? customer.phone,
      phone: customer.phone,
      tier: customer.tier,
      points: customer.points,
      totalSpent: num(customer.totalSpent),
    })),
    recent: recent.map((customer) => ({
      id: customer.id,
      name: customer.fullName ?? customer.phone,
      phone: customer.phone,
      createdAt: customer.createdAt.toISOString(),
    })),
  };
}

async function getEmployees() {
  const now = new Date();
  const employees = await db.employee.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      branch: true,
      kpiRecords: { where: { year: now.getFullYear(), month: now.getMonth() + 1 } },
    },
  });

  return {
    total: employees.length,
    active: employees.filter((employee) => employee.status === "ACTIVE").length,
    onLeave: employees.filter((employee) => employee.status === "ON_LEAVE").length,
    inactive: employees.filter((employee) => employee.status === "INACTIVE").length,
    list: employees.map((employee) => ({
      id: employee.id,
      fullName: employee.fullName,
      position: employee.position,
      branch: employee.branch.name,
      status: employee.status,
      baseSalary: num(employee.baseSalary),
      kpi: employee.kpiRecords[0]?.totalScore ?? null,
    })),
  };
}

async function getKpi() {
  const now = new Date();
  const ranking = await db.kpiRecord.findMany({
    where: { year: now.getFullYear(), month: now.getMonth() + 1 },
    include: { employee: true },
    orderBy: { totalScore: "desc" },
  });
  const avg = ranking.length
    ? Math.round((ranking.reduce((sum, row) => sum + row.totalScore, 0) / ranking.length) * 10) / 10
    : 0;

  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    avg,
    bonusFund: ranking.reduce((sum, row) => sum + num(row.bonusAmount), 0),
    over90: ranking.filter((row) => row.totalScore >= 90).length,
    under60: ranking.filter((row) => row.totalScore < 60).length,
    ranking: ranking.map((row) => ({
      id: row.id,
      employee: row.employee.fullName,
      position: row.employee.position,
      totalScore: row.totalScore,
      bonusPercent: row.bonusPercent,
      bonusAmount: num(row.bonusAmount),
      scores: {
        sales: row.salesScore,
        margin: row.marginScore,
        attendance: row.attendanceScore,
        discipline: row.disciplineScore,
        customer: row.customerScore,
      },
    })),
  };
}

async function getAttendance() {
  const today = startOfDay();
  const tomorrow = new Date(today.getTime() + 864e5);
  const monthStart = startOfMonth(0);
  const [employees, todayRecords, monthRecords] = await Promise.all([
    db.employee.findMany({ where: { status: { not: "INACTIVE" } }, orderBy: { createdAt: "asc" } }),
    db.attendance.findMany({ where: { date: { gte: today, lt: tomorrow } } }),
    db.attendance.findMany({ where: { date: { gte: monthStart } } }),
  ]);

  const byEmp = new Map(todayRecords.map((record) => [record.employeeId, record]));
  const records = employees.map((employee) => {
    const attendance = byEmp.get(employee.id);
    return {
      employeeId: employee.id,
      name: employee.fullName,
      status: attendance?.status ?? null,
      checkIn: attendance?.checkIn?.toISOString() ?? null,
      lateMinutes: attendance?.lateMinutes ?? 0,
      penalty: attendance?.penalty ?? 0,
    };
  });
  const checkIns = todayRecords.filter((record) => record.checkIn).map((record) => record.checkIn!);

  return {
    records,
    presentCount: records.filter((record) => record.status === "PRESENT" || record.status === "LATE").length,
    totalEmployees: employees.length,
    lateThisMonth: monthRecords.filter((record) => record.lateMinutes > 5).length,
    totalPenalty: monthRecords.reduce((sum, record) => sum + record.penalty, 0),
    perfect: monthRecords.filter((record) => record.status === "PRESENT" && record.lateMinutes === 0).length,
    avgCheckIn: checkIns.length
      ? new Date(checkIns.reduce((sum, date) => sum + date.getTime(), 0) / checkIns.length).toISOString()
      : null,
  };
}

async function getReports() {
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

  const kpiMap = new Map(kpis.map((kpi) => [kpi.employeeId, kpi.totalScore]));
  const correlation = marginRows
    .map((row) => ({
      employee: row.name,
      label: `${row.name.split(" ")[0]} (${kpiMap.get(row.id) ?? "-"})`,
      margin: row.margin,
      marginMln: +M(row.margin).toFixed(1),
      kpi: kpiMap.get(row.id) ?? 0,
    }))
    .sort((a, b) => b.kpi - a.kpi);
  const critical = lowProducts.find((product) => product.stock < product.minStock * 0.4);

  return {
    correlation,
    critical: critical
      ? {
          id: critical.id,
          name: critical.name,
          stock: critical.stock,
          minStock: critical.minStock,
        }
      : null,
  };
}

async function getOptions() {
  const [products, employees, customers] = await Promise.all([
    db.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      take: 120,
      select: { id: true, name: true, stock: true, salePrice: true, category: true },
    }),
    db.employee.findMany({
      where: { status: { not: "INACTIVE" } },
      orderBy: { fullName: "asc" },
      take: 80,
      select: { id: true, fullName: true, position: true },
    }),
    db.customer.findMany({
      orderBy: { createdAt: "desc" },
      take: 120,
      select: { id: true, fullName: true, phone: true, points: true },
    }),
  ]);

  return {
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      stock: product.stock,
      salePrice: num(product.salePrice),
      category: product.category,
    })),
    employees: employees.map((employee) => ({
      id: employee.id,
      name: employee.fullName,
      position: employee.position,
    })),
    customers: customers.map((customer) => ({
      id: customer.id,
      name: customer.fullName ?? customer.phone,
      phone: customer.phone,
      points: customer.points,
    })),
  };
}

type GrantedAccess = Extract<RequestAccess, { ok: true }>;

function has(access: GrantedAccess, permission: AppPermission) {
  return canRead(access, permission);
}

function emptyFinance() {
  return {
    todaySales: 0,
    todayTrend: 0,
    monthlyProfit: 0,
    profitTrend: 0,
    cashTotal: 0,
    cash: 0,
    card: 0,
    mixed: 0,
    inventoryValue: 0,
    weekSales: [],
    categories: [],
    sixMonths: [],
  };
}

function emptySales() {
  return {
    todayTotal: 0,
    todayCount: 0,
    recent: [],
  };
}

function emptyInventory() {
  return {
    totalCount: 0,
    inventoryValue: 0,
    lowStockCount: 0,
    expiringCount: 0,
    lowStock: [],
    expiring: [],
  };
}

function emptyExpenses() {
  return {
    total: 0,
    categories: [],
    recent: [],
  };
}

function emptyCustomers() {
  return {
    total: 0,
    viaTelegram: 0,
    totalPoints: 0,
    tiers: { bronze: 0, silver: 0, gold: 0 },
    top: [],
    recent: [],
  };
}

function emptyEmployees() {
  return {
    total: 0,
    active: 0,
    onLeave: 0,
    inactive: 0,
    list: [],
  };
}

function emptyKpi() {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    avg: 0,
    bonusFund: 0,
    over90: 0,
    under60: 0,
    ranking: [],
  };
}

function emptyAttendance() {
  return {
    records: [],
    presentCount: 0,
    totalEmployees: 0,
    lateThisMonth: 0,
    totalPenalty: 0,
    perfect: 0,
    avgCheckIn: null,
  };
}

function emptyReports() {
  return {
    correlation: [],
    critical: null,
  };
}

function emptyOptions() {
  return {
    products: [],
    employees: [],
    customers: [],
  };
}

export async function GET(req: NextRequest) {
  const access = await verifyRequestAccess(req);
  if (!access.ok) {
    return Response.json({ ok: false, error: access.error }, { status: access.status });
  }

  const allowed = {
    finance: has(access, "moliya"),
    sales: has(access, "pos") || has(access, "moliya"),
    inventory: has(access, "ombor"),
    expenses: has(access, "harajatlar"),
    customers: has(access, "mijozlar"),
    employees: has(access, "xodimlar"),
    kpi: has(access, "kpi"),
    attendance: has(access, "davomat"),
    reports: has(access, "hisobotlar"),
  };
  const needsOptions =
    allowed.sales || allowed.inventory || allowed.customers || allowed.employees || allowed.kpi || allowed.attendance;

  const [finance, sales, inventory, expenses, customers, employees, kpi, attendance, reports, options] =
    await Promise.all([
      allowed.finance ? getFinance() : emptyFinance(),
      allowed.sales ? getSales() : emptySales(),
      allowed.inventory ? getInventory() : emptyInventory(),
      allowed.expenses ? getExpenses() : emptyExpenses(),
      allowed.customers ? getCustomers() : emptyCustomers(),
      allowed.employees ? getEmployees() : emptyEmployees(),
      allowed.kpi ? getKpi() : emptyKpi(),
      allowed.attendance ? getAttendance() : emptyAttendance(),
      allowed.reports ? getReports() : emptyReports(),
      needsOptions ? getOptions() : emptyOptions(),
    ]);
  const filteredOptions = {
    products: allowed.sales || allowed.inventory ? options.products : [],
    employees: allowed.sales || allowed.employees || allowed.kpi || allowed.attendance ? options.employees : [],
    customers: allowed.sales || allowed.customers ? options.customers : [],
  };

  return Response.json({
    ok: true,
    user: access.user,
    access: {
      source: access.source,
      role: access.user.role,
      permissions: access.user.permissions,
      editPermissions: access.user.editPermissions,
    },
    generatedAt: new Date().toISOString(),
    data: {
      finance,
      sales,
      inventory,
      expenses,
      customers,
      employees,
      kpi,
      attendance,
      reports,
      options: filteredOptions,
    },
  });
}
