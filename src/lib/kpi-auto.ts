import "server-only";
import { db } from "@/lib/db";
import { nameKey, namesMatch } from "@/lib/cashiers";
import { bonusAmount, bonusPercentForScore, computeTotalScore, type KpiComponents } from "@/lib/kpi";

/**
 * KPI — kassir smenalaridan avtomatik (F-Apteka cheklari, CashierShift).
 *
 * Har bir qism dorixona ichida taqqoslanadi: Yunusobod va Shayxontohurning
 * savdo hajmi har xil, kassirni o'z dorixonasining o'rtachasi bilan
 * solishtirish adolatli. O'rtachaga teng natija — 80 ball, 25% yuqori — 100.
 *
 *   Savdo   40% — bir soatlik savdo (qaytarish ayirilgan)
 *   Marja   20% — o'rtacha chek (kassir bo'yicha tan narx hali kelmaydi)
 *   Davomat 15% — ishlagan kunlar, dorixonada eng ko'p ishlaganga nisbatan
 *   Intizom 10% — 100 − qaytarish ulushi − Davomat bo'limidagi jarimalar
 *   Mijoz   15% — bir soatda xizmat qilingan mijoz (cheklar)
 *
 * Smenasi bo'lmagan xodim (kassada turmaydigan) tegilmaydi — unga KPI
 * qo'lda kiritiladi.
 */

const AT_AVERAGE = 80;

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const relative = (value: number, average: number) => (average > 0 ? clamp((value / average) * AT_AVERAGE) : 0);

type Totals = { net: number; sales: number; returns: number; hours: number; checks: number; days: Set<string> };

export async function syncAutoKpi(year: number, month: number) {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));

  const [employees, shifts, attendance] = await Promise.all([
    db.employee.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, fullName: true, unit: true, baseSalary: true },
    }),
    db.cashierShift.findMany({ where: { day: { gte: from, lt: to } } }),
    db.attendance.groupBy({
      by: ["employeeId"],
      _sum: { penalty: true },
      where: { date: { gte: from, lt: to } },
    }),
  ]);
  if (!shifts.length) return { updated: 0, unmatched: [] as string[] };

  const keyed = employees.map((e) => ({ ...e, key: nameKey(e.fullName) }));
  const totals = new Map<string, Totals & { unit: string }>();
  const unmatched = new Set<string>();

  for (const shift of shifts) {
    const key = nameKey(shift.cashier);
    let candidates = keyed.filter((e) => namesMatch(key, e.key));
    if (candidates.length > 1) candidates = candidates.filter((e) => e.unit === shift.unit);
    if (candidates.length !== 1) {
      unmatched.add(`${shift.cashier} (${shift.unit})`);
      continue;
    }
    const id = candidates[0].id;
    const t = totals.get(id) ?? {
      unit: shift.unit, net: 0, sales: 0, returns: 0, hours: 0, checks: 0, days: new Set<string>(),
    };
    const sales = Number(shift.sales);
    const returns = Number(shift.returns);
    t.sales += sales;
    t.returns += returns;
    t.net += sales - returns;
    t.hours += Math.max(0, (shift.closedAt.getTime() - shift.openedAt.getTime()) / 3_600_000);
    t.checks += shift.checks;
    t.days.add(shift.day.toISOString().slice(0, 10));
    totals.set(id, t);
  }

  // Dorixona o'rtachalari — shu oyda smenasi bo'lgan xodimlar bo'yicha
  const units = new Map<string, { net: number; hours: number; checks: number; maxDays: number }>();
  for (const t of totals.values()) {
    const u = units.get(t.unit) ?? { net: 0, hours: 0, checks: 0, maxDays: 0 };
    u.net += t.net;
    u.hours += t.hours;
    u.checks += t.checks;
    u.maxDays = Math.max(u.maxDays, t.days.size);
    units.set(t.unit, u);
  }

  const penalties = new Map(attendance.map((a) => [a.employeeId, a._sum.penalty ?? 0]));
  let updated = 0;

  for (const employee of employees) {
    const t = totals.get(employee.id);
    if (!t) continue;
    const u = units.get(t.unit)!;
    const perHour = (value: number, hours: number) => (hours > 0 ? value / hours : 0);

    const returnShare = t.sales > 0 ? t.returns / t.sales : 0;
    const components: KpiComponents = {
      salesScore: relative(perHour(t.net, t.hours), perHour(u.net, u.hours)),
      marginScore: relative(t.checks > 0 ? t.net / t.checks : 0, u.checks > 0 ? u.net / u.checks : 0),
      attendanceScore: u.maxDays > 0 ? clamp((t.days.size / u.maxDays) * 100) : 0,
      // 1% qaytarish = 5 ball
      disciplineScore: clamp(100 - returnShare * 500 - (penalties.get(employee.id) ?? 0)),
      customerScore: relative(perHour(t.checks, t.hours), perHour(u.checks, u.hours)),
    };
    const totalScore = computeTotalScore(components);
    const data = {
      ...components,
      totalScore,
      bonusPercent: bonusPercentForScore(totalScore),
      bonusAmount: bonusAmount(Number(employee.baseSalary), totalScore),
    };
    await db.kpiRecord.upsert({
      where: { employeeId_year_month: { employeeId: employee.id, year, month } },
      create: { employeeId: employee.id, year, month, ...data },
      update: data,
    });
    updated += 1;
  }

  return { updated, unmatched: [...unmatched] };
}

/**
 * Joriy oy (Toshkent vaqti) va oyning birinchi 5 kunida o'tgan oy ham —
 * oy oxiridagi smenalar ham hisobga kirsin.
 */
export async function syncAutoKpiNow(now = new Date()) {
  const local = new Date(now.getTime() + 5 * 3600_000);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth() + 1;
  const current = await syncAutoKpi(year, month);
  if (local.getUTCDate() <= 5) {
    const prev = new Date(Date.UTC(year, month - 2, 1));
    await syncAutoKpi(prev.getUTCFullYear(), prev.getUTCMonth() + 1);
  }
  return current;
}
