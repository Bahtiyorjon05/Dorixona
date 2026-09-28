import "server-only";
import { db } from "@/lib/db";
import { REVALUATION_EXPENSE_TITLE } from "@/lib/revaluation";

/**
 * Doimiy xarajatlar (ijara, kommunal, oylik...) har oy o'zi yoziladi.
 *
 * Har oy bir marta, 5-sanada: o'tgan oyda "doimiy" belgisi bilan turgan har
 * bir xarajat shu oyga o'sha summa bilan ko'chiriladi. 5-sanagacha oyliklar
 * berib bo'linadi — menejer summani o'zgartirib, qo'lda kiritgan bo'lsa,
 * shu oyda xuddi shu nom bilan (o'sha dorixonada) yozuv bor, u qo'shilmaydi.
 *
 * Oyiga bir martagina ishlaydi — jurnalga belgi qo'yiladi. Shuning uchun
 * avtomatik yozilgan xarajatni o'chirsangiz, qaytib paydo bo'lmaydi.
 * To'xtatish uchun xarajatdagi "Doimiy xarajat" belgisini olib tashlang:
 * keyingi oydan boshlab ko'chirilmaydi.
 *
 * Oyliklar o'tgan oydan ko'chirilmaydi — Xodimlar bo'limidagi har bir aktiv
 * xodimning hozirgi maoshi yoziladi ("Oylik — <ism>", xodimning dorixonasiga).
 * Menejer maoshni Xodimlar bo'limida o'zgartirsa, keyingi oy yangisi ketadi.
 *
 * Pereotsenka ko'chirilmaydi — u har oy F-Apteka'dan qayta hisoblanadi.
 */

const LOG_SOURCE = "doimiy-harajat";
/** Sentabr qo'lda kiritilgan — avtomatika oktabrdan boshlanadi */
const AUTO_START = Date.UTC(2026, 9, 1);
/** Oyning shu sanasidan boshlab ko'chiriladi */
const CARRY_DAY = 5;
/** Ikki so'rov bir vaqtda kelsa, xarajat ikki marta yozilmasin */
const LOCK_KEY = 7_311_2026;

/** Toshkent vaqti (UTC+5) bo'yicha joriy oy */
function tashkentMonth(now: Date) {
  const local = new Date(now.getTime() + 5 * 3600_000);
  return { year: local.getUTCFullYear(), month: local.getUTCMonth(), day: local.getUTCDate() };
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/** Xodimning oylik xarajati nomi. Avgust-sentabrda qo'lda faqat ism bilan yozilgan */
export function salaryTitles(fullName: string) {
  const name = fullName.trim().replace(/\s+/g, " ");
  return { title: `Oylik — ${name}`, short: `Oylik — ${name.split(" ")[0]}` };
}

function sameKey(title: string, unit: string | null, branchId: string) {
  return `${branchId}|${unit ?? ""}|${title.trim().toLowerCase()}`;
}

export type RecurringCarryResult =
  | { status: "done"; month: string; created: { title: string; unit: string | null; amount: number }[] }
  | { status: "already"; month: string }
  | { status: "not-started"; month: string }
  | { status: "waiting"; month: string; day: number };

async function alreadyCarried(key: string) {
  const mark = await db.integrationLog.findFirst({
    where: { source: LOG_SOURCE, ok: true, note: { startsWith: key } },
    select: { id: true },
  });
  return Boolean(mark);
}

export async function carryRecurringExpenses(now = new Date()): Promise<RecurringCarryResult> {
  const { year, month, day } = tashkentMonth(now);
  const key = monthKey(year, month);
  const monthStart = new Date(Date.UTC(year, month, 1));
  if (monthStart.getTime() < AUTO_START) return { status: "not-started", month: key };
  if (day < CARRY_DAY) return { status: "waiting", month: key, day: CARRY_DAY };

  // Ko'p hollarda shu yerda tugaydi — sahifa har ochilganda tranzaksiya ochilmasin
  if (await alreadyCarried(key)) return { status: "already", month: key };

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_KEY})`;

    const mark = await tx.integrationLog.findFirst({
      where: { source: LOG_SOURCE, ok: true, note: { startsWith: key } },
      select: { id: true },
    });
    if (mark) return { status: "already", month: key } as const;

    const prevStart = new Date(Date.UTC(year, month - 1, 1));
    const nextStart = new Date(Date.UTC(year, month + 1, 1));
    const [previous, current, employees] = await Promise.all([
      tx.expense.findMany({
        where: {
          isRecurring: true,
          category: { not: "SALARY" },
          title: { not: REVALUATION_EXPENSE_TITLE },
          spentAt: { gte: prevStart, lt: monthStart },
        },
        orderBy: { spentAt: "desc" },
      }),
      tx.expense.findMany({
        where: { spentAt: { gte: monthStart, lt: nextStart } },
        select: { title: true, unit: true, branchId: true, category: true },
      }),
      tx.employee.findMany({
        where: { status: "ACTIVE", baseSalary: { gt: 0 } },
        orderBy: { fullName: "asc" },
      }),
    ]);

    const taken = new Set(current.map((e) => sameKey(e.title, e.unit, e.branchId)));
    // 5-sana, kun o'rtasida: UTC ham, Toshkent ham shu kunga tushadi
    const spentAt = new Date(Date.UTC(year, month, CARRY_DAY, 12));
    const created: { title: string; unit: string | null; amount: number }[] = [];

    for (const expense of previous) {
      const id = sameKey(expense.title, expense.unit, expense.branchId);
      if (taken.has(id)) continue;
      taken.add(id);
      await tx.expense.create({
        data: {
          title: expense.title,
          category: expense.category,
          amount: expense.amount,
          isRecurring: true,
          unit: expense.unit,
          spentAt,
          branchId: expense.branchId,
        },
      });
      created.push({ title: expense.title, unit: expense.unit, amount: Number(expense.amount) });
    }

    // Oylik shu oyda qo'lda yozilgan bo'lsa (to'liq ism yoki faqat ism bilan) — tegilmaydi
    const salaryTaken = new Set(
      current.filter((e) => e.category === "SALARY").map((e) => e.title.trim().toLowerCase()),
    );
    for (const employee of employees) {
      const { title, short } = salaryTitles(employee.fullName);
      if (salaryTaken.has(title.toLowerCase()) || salaryTaken.has(short.toLowerCase())) continue;
      salaryTaken.add(title.toLowerCase());
      await tx.expense.create({
        data: {
          title,
          category: "SALARY",
          amount: employee.baseSalary,
          isRecurring: true,
          unit: employee.unit,
          spentAt,
          branchId: employee.branchId,
        },
      });
      created.push({ title, unit: employee.unit, amount: Number(employee.baseSalary) });
    }

    const list = created.map((e) => `${e.title}${e.unit ? ` (${e.unit})` : ""}: ${e.amount}`).join("; ");
    await tx.integrationLog.create({
      data: {
        source: LOG_SOURCE,
        rowCount: created.length,
        note: `${key} | ${created.length} ta ko'chirildi${list ? ` | ${list}` : ""}`.slice(0, 3000),
        ok: true,
      },
    });

    return { status: "done", month: key, created } as const;
  });
}
