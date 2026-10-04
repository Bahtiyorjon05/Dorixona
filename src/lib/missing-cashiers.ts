import "server-only";
import { db } from "@/lib/db";
import { nameKey, namesMatch } from "@/lib/cashiers";

/** Oxirgi 60 kunda smena ochgan, lekin ERP xodimlariga bog'lanmagan kassirlar */
export async function getMissingCashiers() {
  try {
    const since = new Date(Date.now() - 60 * 864e5);
    const [shifts, employees] = await Promise.all([
      db.cashierShift.groupBy({
        by: ["unit", "userId", "cashier"],
        _count: { _all: true },
        _max: { day: true },
        where: { day: { gte: since } },
      }),
      db.employee.findMany({ where: { status: { not: "INACTIVE" } }, select: { fullName: true, unit: true } }),
    ]);
    const keyed = employees.map((e) => ({ unit: e.unit, key: nameKey(e.fullName) }));
    return shifts
      .filter((s) => {
        const key = nameKey(s.cashier);
        // "Smena 3", "Kassir 1" kabi umumiy loginlar xodim emas
        if (!key || /^(smena|kassir|kassa|administrator|manager)$/.test(key)) return false;
        return !keyed.some((e) => namesMatch(key, e.key));
      })
      .map((s) => ({
        cashier: s.cashier,
        unit: s.unit,
        shifts: s._count._all,
        lastDay: s._max.day ? s._max.day.toISOString().slice(0, 10).split("-").reverse().join(".") : "",
      }))
      .sort((a, b) => b.shifts - a.shifts);
  } catch {
    return [];
  }
}
