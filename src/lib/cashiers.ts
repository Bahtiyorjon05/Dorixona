import "server-only";
import { db } from "@/lib/db";
import { otdelUnitMap } from "@/lib/integrations/fapteka/otdel";
import { utcDay } from "@/lib/monthly-finance";

/**
 * Kassirlar va smenalar — F-Apteka cheklaridan.
 *
 * Relay skript NGLOBAL.INVOICE dan smena × kassir jamlanmasini yuboradi
 * (sotuv DOCTYPE 2, qaytarish 4). F-Apteka'ning SMENA jadvali eskirgan
 * (oxirgi yozuv 2025), shuning uchun smena cheklardan tuziladi: ochilish =
 * birinchi chek, yopilish = oxirgi chek.
 */

/** Relay yuboradigan qator */
export type ShiftDbRow = {
  /** otdel: 2 = Yunusobod, 3 = Shayxontohur */
  OTD?: string;
  /** SMENA ID */
  SM?: string;
  /** USERS ID */
  U?: string;
  /** kassir ismi */
  NAME?: string;
  /** birinchi chek, yyyy-MM-ddTHH:mm:ss (Toshkent) */
  A?: string;
  /** oxirgi chek */
  B?: string;
  /** cheklar soni */
  C?: string;
  /** sotuv summasi */
  S?: string;
  /** qaytarish summasi (musbat) */
  R?: string;
};

const toNumber = (value: unknown) => {
  const n = Number(String(value ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** "2026-10-01T08:53:12" (Toshkent) -> Date */
function tashkentDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null;
  const date = new Date(`${value.slice(0, 19)}+05:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function syncShiftsFromDb(rows: ShiftDbRow[]) {
  const units = otdelUnitMap();
  let saved = 0;
  let skipped = 0;

  for (const row of rows) {
    const unit = units.get(String(row.OTD ?? "").trim());
    const shiftId = String(row.SM ?? "").trim();
    const userId = String(row.U ?? "").trim();
    const openedAt = tashkentDate(row.A);
    const closedAt = tashkentDate(row.B) ?? openedAt;
    if (!unit || !shiftId || !userId || !openedAt || !closedAt) {
      skipped += 1;
      continue;
    }
    const data = {
      cashier: (row.NAME ?? "").trim() || `Kassir ${userId}`,
      openedAt,
      closedAt,
      day: new Date(`${String(row.A).slice(0, 10)}T00:00:00Z`),
      checks: Math.round(toNumber(row.C)),
      sales: Math.round(toNumber(row.S) * 100) / 100,
      returns: Math.round(Math.abs(toNumber(row.R)) * 100) / 100,
    };
    await db.cashierShift.upsert({
      where: { unit_shiftId_userId: { unit, shiftId, userId } },
      create: { unit, shiftId, userId, ...data },
      update: data,
    });
    saved += 1;
  }
  return { saved, skipped };
}

export type CashierShiftView = {
  id: string;
  unit: string;
  cashier: string;
  openedAt: Date;
  closedAt: Date;
  hours: number;
  checks: number;
  net: number;
};

export type CashierTotal = {
  key: string;
  unit: string;
  cashier: string;
  shifts: number;
  days: number;
  hours: number;
  checks: number;
  net: number;
  avgCheck: number;
  share: number;
};

export type CashierData = {
  known: boolean;
  shifts: CashierShiftView[];
  cashiers: CashierTotal[];
  /** Davomat: kassir -> "yyyy-mm-dd" -> ishlagan soat */
  calendar: { key: string; unit: string; cashier: string; days: Record<string, number> }[];
  totalNet: number;
};

const EMPTY: CashierData = { known: false, shifts: [], cashiers: [], calendar: [], totalNet: 0 };

/**
 * Sana oralig'idagi smenalar (from, to — mahalliy sana, to ham kiradi).
 * unit = null — ikkala dorixona.
 */
export async function getCashierData(input: { from: Date; to: Date; unit: string | null }): Promise<CashierData> {
  const start = utcDay(input.from);
  const end = new Date(utcDay(input.to).getTime() + 864e5);
  let rows;
  try {
    rows = await db.cashierShift.findMany({
      where: { day: { gte: start, lt: end }, ...(input.unit ? { unit: input.unit } : {}) },
      orderBy: { openedAt: "desc" },
    });
  } catch {
    // Jadval hali yaratilmagan (prisma/manual/kassir-smenalari.sql)
    return EMPTY;
  }
  if (!rows.length) return { ...EMPTY, known: true };

  const shifts: CashierShiftView[] = rows.map((row) => ({
    id: row.id,
    unit: row.unit,
    cashier: row.cashier,
    openedAt: row.openedAt,
    closedAt: row.closedAt,
    hours: Math.max(0, (row.closedAt.getTime() - row.openedAt.getTime()) / 3_600_000),
    checks: row.checks,
    net: Number(row.sales) - Number(row.returns),
  }));

  const totals = new Map<string, CashierTotal & { daySet: Set<string> }>();
  const calendar = new Map<string, { key: string; unit: string; cashier: string; days: Record<string, number> }>();
  for (const [index, shift] of shifts.entries()) {
    const row = rows[index];
    const key = `${row.unit}|${row.userId}`;
    const dayKey = row.day.toISOString().slice(0, 10);
    const total = totals.get(key) ?? {
      key, unit: row.unit, cashier: row.cashier, shifts: 0, days: 0, hours: 0, checks: 0, net: 0,
      avgCheck: 0, share: 0, daySet: new Set<string>(),
    };
    total.shifts += 1;
    total.hours += shift.hours;
    total.checks += shift.checks;
    total.net += shift.net;
    total.daySet.add(dayKey);
    totals.set(key, total);

    const entry = calendar.get(key) ?? { key, unit: row.unit, cashier: row.cashier, days: {} };
    entry.days[dayKey] = (entry.days[dayKey] ?? 0) + shift.hours;
    calendar.set(key, entry);
  }

  const totalNet = [...totals.values()].reduce((sum, t) => sum + t.net, 0);
  const cashiers = [...totals.values()]
    .map(({ daySet, ...t }) => ({
      ...t,
      days: daySet.size,
      avgCheck: t.checks > 0 ? t.net / t.checks : 0,
      share: totalNet > 0 ? (t.net / totalNet) * 100 : 0,
    }))
    .sort((a, b) => b.net - a.net);

  return {
    known: true,
    shifts: shifts.slice(0, 200),
    cashiers,
    calendar: [...calendar.values()].sort((a, b) => a.unit.localeCompare(b.unit) || a.cashier.localeCompare(b.cashier)),
    totalNet,
  };
}
