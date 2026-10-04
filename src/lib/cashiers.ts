import "server-only";
import { Prisma } from "@/generated/prisma/client";
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
  /** sotilgan tovarning tan narxi (KOL x INCOMELN.PRICESKID, relay v23+) */
  CS?: string;
  /** qaytarilgan tovarning tan narxi */
  CR?: string;
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
  let skipped = 0;
  const items: {
    unit: string;
    shiftId: string;
    userId: string;
    data: {
      cashier: string; openedAt: Date; closedAt: Date; day: Date;
      checks: number; sales: number; returns: number;
    };
    cost: number | null;
  }[] = [];

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
    items.push({
      unit,
      shiftId,
      userId,
      data: {
        cashier: (row.NAME ?? "").trim() || `Kassir ${userId}`,
        openedAt,
        closedAt,
        day: new Date(`${String(row.A).slice(0, 10)}T00:00:00Z`),
        checks: Math.round(toNumber(row.C)),
        sales: Math.round(toNumber(row.S) * 100) / 100,
        returns: Math.round(Math.abs(toNumber(row.R)) * 100) / 100,
      },
      // Eski relay (CS yo'q) yozgan tan narxni o'chirmasin
      cost:
        row.CS !== undefined
          ? Math.round((toNumber(row.CS) - Math.abs(toNumber(row.CR))) * 100) / 100
          : null,
    });
  }

  // Ketma-ket yozilganda 40 kunlik (200+ smena) yuborish Vercel vaqtiga
  // sig'masdi (504) — 10 tadan parallel
  for (let index = 0; index < items.length; index += 10) {
    await Promise.all(
      items.slice(index, index + 10).map(({ unit, shiftId, userId, data }) =>
        db.cashierShift.upsert({
          where: { unit_shiftId_userId: { unit, shiftId, userId } },
          create: { unit, shiftId, userId, ...data },
          update: data,
        }),
      ),
    );
  }

  // Tan narx (KPI marjasi uchun) — bitta so'rov bilan. Ustun Prisma
  // sxemasida yo'q: prisma/manual/smena-tan-narx.sql ishga tushirilmagan
  // bo'lsa ham smenalar yozilaveradi.
  const costed = items.filter((item) => item.cost !== null);
  for (let index = 0; index < costed.length; index += 500) {
    const chunk = costed.slice(index, index + 500);
    try {
      await db.$executeRaw`
        UPDATE "CashierShift" s SET "cost" = v.cost
        FROM (VALUES ${Prisma.join(
          chunk.map((item) => Prisma.sql`(${item.unit}, ${item.shiftId}, ${item.userId}, ${item.cost}::numeric)`),
        )}) AS v(unit, "shiftId", "userId", cost)
        WHERE s."unit" = v.unit AND s."shiftId" = v."shiftId" AND s."userId" = v."userId"`;
    } catch {
      // Ustun hali yaratilmagan
      break;
    }
  }

  return { saved: items.length, skipped };
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

const CYR: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya",
  ў: "o", қ: "q", ғ: "g", ҳ: "x",
};

/** Ismning birinchi so'zi: lotincha, kichik harf, faqat harflar ("УМИДЖОН" -> "umidjon") */
export function nameKey(name: string) {
  const first = name.trim().toLowerCase().split(/\s+/)[0] ?? "";
  return [...first]
    .map((ch) => CYR[ch] ?? ch)
    .join("")
    // Shuhrat / Shuxrat bir xil bo'lsin, lekin "sh", "ch" buzilmasin
    .replace(/(?<![sc])h/g, "x")
    .replace(/[^a-z]/g, "");
}

export function namesMatch(a: string, b: string) {
  if (!a || !b) return false;
  if (a === b) return true;
  return a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a));
}

export type TodayShift = { opened: Date; closed: Date; active: boolean; unit: string; checks: number; cashier: string };

/** Hozirgi ish kuni ("YYYY-MM-DD"): ish kuni 06:00 da boshlanadi (Toshkent) */
export function currentWorkDay(now = new Date()) {
  return new Date(now.getTime() + 5 * 3600_000 - 6 * 3600_000).toISOString().slice(0, 10);
}

/** Kassa ochiq deb hisoblanadigan eng uzoq tanaffus (oxirgi chekdan) */
const OPEN_GAP_MS = 3 * 3600_000;

/**
 * Kun smenalari (ish kuni: 06:00 dan) — ERP xodimlariga ism bo'yicha
 * bog'langan. Kassir ikki xodimga to'g'ri kelsa, o'sha dorixonadagisi
 * tanlanadi; baribir aniq bo'lmasa — bog'lanmagan qoladi.
 *
 * Kassa yopilgani F-Apteka'dan kelmaydi (SMENA jadvali eskirgan), shuning
 * uchun: shu dorixonada keyingi kassir smena ochgan bo'lsa yoki oxirgi
 * chekdan 3 soat o'tgan bo'lsa — yopilgan; aks holda hali smenada.
 */
export async function todayShiftsByEmployee(
  employees: { id: string; fullName: string; unit: string | null }[],
  day: string = currentWorkDay(),
): Promise<{ byEmployee: Record<string, TodayShift>; unmatched: { cashier: string; unit: string }[] }> {
  const now = new Date();
  let rows: Awaited<ReturnType<typeof db.cashierShift.findMany>> = [];
  try {
    rows = await db.cashierShift.findMany({
      where: { day: new Date(`${day}T00:00:00Z`) },
      orderBy: { openedAt: "asc" },
    });
  } catch {
    return { byEmployee: {}, unmatched: [] };
  }
  const isToday = day === currentWorkDay(now);

  const keyed = employees.map((e) => ({ ...e, key: nameKey(e.fullName) }));
  const byEmployee: Record<string, TodayShift> = {};
  const unmatched = new Map<string, { cashier: string; unit: string }>();

  for (const row of rows) {
    const key = nameKey(row.cashier);
    let candidates = keyed.filter((e) => namesMatch(key, e.key));
    if (candidates.length > 1) candidates = candidates.filter((e) => e.unit === row.unit);
    if (candidates.length !== 1) {
      unmatched.set(`${row.unit}|${row.userId}`, { cashier: row.cashier, unit: row.unit });
      continue;
    }
    const id = candidates[0].id;
    const prev = byEmployee[id];
    // Kun ichida bir nechta smena bo'lsa — eng erta ochilishdan eng kech yopilishgacha
    const opened = prev && prev.opened < row.openedAt ? prev.opened : row.openedAt;
    const closed = prev && prev.closed > row.closedAt ? prev.closed : row.closedAt;
    const relievedBy = rows.some(
      (other) => other !== row && other.unit === row.unit && other.userId !== row.userId && other.openedAt > closed,
    );
    byEmployee[id] = {
      opened,
      closed,
      active: isToday && !relievedBy && now.getTime() - closed.getTime() < OPEN_GAP_MS,
      unit: row.unit,
      checks: (prev?.checks ?? 0) + row.checks,
      cashier: row.cashier,
    };
  }
  return { byEmployee, unmatched: [...unmatched.values()] };
}
