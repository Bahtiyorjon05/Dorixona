import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { otdelUnitMap } from "@/lib/integrations/fapteka/otdel";

/**
 * Pereotsenka (qayta baholash) — har oy har bir dorixonaga doimiy harajat.
 *
 * F-Apteka API'si pereotsenkani bermaydi, shuning uchun uni o'zimiz
 * hisoblaymiz: SITE.exe har 5 daqiqada har bir dorixonadagi har bir
 * dorining qoldig'i (K) va chakana narxini (P) yuboradi. Narx o'zgarsa,
 * qoldiq × (yangi − eski) — F-Apteka'ning "Переоценка" oynasidagi bilan
 * bir xil hisob.
 */

export const REVALUATION_EXPENSE_TITLE = "Pereotsenka";

/** Toshkent vaqti (UTC+5) bo'yicha oy chegaralari, UTC da */
function tashkentMonth(date: Date) {
  const local = new Date(date.getTime() + 5 * 3600_000);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth() + 1;
  const start = new Date(Date.UTC(year, month - 1, 1) - 5 * 3600_000);
  const end = new Date(Date.UTC(year, month, 1) - 5 * 3600_000);
  return { year, month, start, end };
}

/**
 * Pereotsenka o'sha dorixonaning shu oydagi doimiy harajati bo'lib yoziladi.
 * Summa musbat (zarar) keladi; nol bo'lsa harajat o'chiriladi.
 */
export async function syncRevaluationExpense(input: {
  branchId: string;
  unit: string;
  year: number;
  month: number;
  amount: number;
}) {
  const unit = input.unit === "Umumiy" ? null : input.unit;
  // Oy o'rtasi: server (UTC) va Toshkent vaqti farqi oyni siljitmasin
  const spentAt = new Date(Date.UTC(input.year, input.month - 1, 15));
  const existing = await db.expense.findMany({
    where: {
      title: REVALUATION_EXPENSE_TITLE,
      unit,
      spentAt: {
        gte: new Date(Date.UTC(input.year, input.month - 1, 1)),
        lt: new Date(Date.UTC(input.year, input.month, 1)),
      },
    },
    select: { id: true },
  });

  if (input.amount <= 0) {
    if (existing.length) await db.expense.deleteMany({ where: { id: { in: existing.map((e) => e.id) } } });
    return;
  }

  const [keep, ...extra] = existing;
  if (extra.length) await db.expense.deleteMany({ where: { id: { in: extra.map((e) => e.id) } } });
  const data = { amount: input.amount, spentAt, isRecurring: true, category: "OTHER" as const };
  if (keep) await db.expense.update({ where: { id: keep.id }, data });
  else {
    await db.expense.create({
      data: { ...data, title: REVALUATION_EXPENSE_TITLE, unit, branchId: input.branchId },
    });
  }
}

const num = (value: unknown) => {
  const n = Number(String(value ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

type Row = Record<string, string>;

export type RevaluationPushResult = {
  /** Shu push'da topilgan narx o'zgarishlari, dorixona bo'yicha summa */
  changes: { unit: string; count: number; amount: number }[];
  /** Kirim bilan birga narx o'zgargani — pereotsenka emas, o'tkazib yuborildi */
  skippedIncoming: number;
  /** Oy boshidan jami, dorixona bo'yicha (faqat o'zgarish bo'lganlar) */
  monthTotals: { unit: string; amount: number }[];
};

/**
 * SITE.exe push'idagi narxlarni oldingisi bilan solishtiradi.
 *
 * - Birinchi marta ko'ringan dori — faqat eslab qolinadi.
 * - Narx o'zgargan, qoldiq ko'paymagan — pereotsenka: qoldiq × farq.
 * - Narx o'zgargan va qoldiq ko'paygan — yangi partiya keldi, narx shundan
 *   o'zgargan bo'lishi mumkin: pereotsenka deb hisoblanmaydi.
 * - Push'da yo'q dori (qoldig'i tugagan) — unutiladi; qaytib kelsa yangi
 *   partiya sifatida qaraladi.
 *
 * Yangi pereotsenka bo'lsa, oy jami MonthlyFinance.revaluation ga va
 * "Pereotsenka" harajatiga yoziladi.
 */
export async function syncRevaluationFromSite(rows: Row[]): Promise<RevaluationPushResult> {
  const units = otdelUnitMap();
  const current = new Map<string, { otdel: string; fid: string; price: number; qty: number; name: string }>();
  for (const row of rows) {
    const otdel = (row.O ?? "").trim();
    const fid = (row.I ?? row.G ?? "").trim();
    if (!otdel || !fid || !units.has(otdel)) continue;
    current.set(`${otdel}|${fid}`, {
      otdel,
      fid,
      price: Math.round(num(row.P) * 100) / 100,
      qty: Math.round(num(row.K ?? row.Q) * 10_000) / 10_000,
      name: (row.N ?? "").trim() || `F-Apteka #${fid}`,
    });
  }
  const otdels = [...new Set([...current.values()].map((item) => item.otdel))];
  const result: RevaluationPushResult = { changes: [], skippedIncoming: 0, monthTotals: [] };
  if (!otdels.length) return result;

  const previous = await db.faptekaPrice.findMany({ where: { otdel: { in: otdels } } });
  const previousMap = new Map(previous.map((item) => [`${item.otdel}|${item.fid}`, item]));

  const events: Prisma.RevaluationCreateManyInput[] = [];
  const toWrite: { otdel: string; fid: string; price: number; qty: number }[] = [];
  for (const [key, item] of current) {
    const before = previousMap.get(key);
    if (!before) {
      toWrite.push(item);
      continue;
    }
    const oldPrice = Number(before.price);
    const oldQty = Number(before.qty);
    const priceChanged = Math.abs(item.price - oldPrice) >= 0.01;
    if (priceChanged) {
      if (item.qty > oldQty + 0.0001) {
        result.skippedIncoming += 1;
      } else if (item.qty > 0) {
        events.push({
          unit: units.get(item.otdel)!,
          otdel: item.otdel,
          fid: item.fid,
          name: item.name.slice(0, 300),
          oldPrice,
          newPrice: item.price,
          qty: item.qty,
          amount: Math.round((item.price - oldPrice) * item.qty * 100) / 100,
        });
      }
    }
    if (priceChanged || Math.abs(item.qty - oldQty) >= 0.0001) toWrite.push(item);
  }
  const gone = previous.filter((item) => !current.has(`${item.otdel}|${item.fid}`));

  for (let index = 0; index < toWrite.length; index += 500) {
    const chunk = toWrite.slice(index, index + 500);
    await db.$executeRaw(Prisma.sql`
      INSERT INTO "FaptekaPrice" ("otdel", "fid", "price", "qty", "updatedAt")
      VALUES ${Prisma.join(chunk.map((item) => Prisma.sql`(${item.otdel}, ${item.fid}, ${item.price}, ${item.qty}, NOW())`))}
      ON CONFLICT ("otdel", "fid") DO UPDATE SET
        "price" = EXCLUDED."price", "qty" = EXCLUDED."qty", "updatedAt" = NOW()
    `);
  }
  for (const otdel of otdels) {
    const fids = gone.filter((item) => item.otdel === otdel).map((item) => item.fid);
    for (let index = 0; index < fids.length; index += 1000) {
      await db.faptekaPrice.deleteMany({ where: { otdel, fid: { in: fids.slice(index, index + 1000) } } });
    }
  }

  if (!events.length) return result;
  await db.revaluation.createMany({ data: events });

  const byUnit = new Map<string, { count: number; amount: number }>();
  for (const event of events) {
    const entry = byUnit.get(event.unit) ?? { count: 0, amount: 0 };
    entry.count += 1;
    entry.amount += Number(event.amount);
    byUnit.set(event.unit, entry);
  }
  result.changes = [...byUnit].map(([unit, entry]) => ({ unit, ...entry }));

  const branch = await db.branch.findFirst({ where: { isActive: true } });
  if (!branch) return result;
  const { year, month, start, end } = tashkentMonth(new Date());
  const periodMonth = new Date(Date.UTC(year, month - 1, 1));
  for (const unit of byUnit.keys()) {
    const sum = await db.revaluation.aggregate({
      _sum: { amount: true },
      where: { unit, at: { gte: start, lt: end } },
    });
    // Narx tushsa summa manfiy — bu zarar, harajatga musbat bo'lib yoziladi
    const loss = Math.max(0, -Number(sum._sum.amount ?? 0));
    await db.monthlyFinance.upsert({
      where: { unit_periodMonth: { unit, periodMonth } },
      create: { unit, periodMonth, branchId: branch.id, revaluation: loss },
      update: { revaluation: loss },
    });
    await syncRevaluationExpense({ branchId: branch.id, unit, year, month, amount: loss });
    result.monthTotals.push({ unit, amount: loss });
  }
  return result;
}
