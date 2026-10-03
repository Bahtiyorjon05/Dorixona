import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { otdelUnitMap } from "@/lib/integrations/fapteka/otdel";

/**
 * Pereotsenka (qayta baholash). Harajat emas: summasi oylik kartadagi
 * "Qayta baholash" qatorida turadi (qo'lda kiritiladi).
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
 * Pereotsenka harajat EMAS — u faqat oylik kartadagi "Qayta baholash"
 * qatorida (MonthlyFinance.revaluation) ko'rsatiladi va sof foydadan
 * ayirilmaydi. Avval harajat sifatida ham yozilardi; shu oy uchun o'sha
 * eski yozuvlar (lotin yoki kirill nomda) bo'lsa, o'chiriladi.
 */
export async function clearRevaluationExpense(input: { unit: string; year: number; month: number }) {
  await db.expense.deleteMany({
    where: {
      unit: input.unit === "Umumiy" ? null : input.unit,
      OR: [
        { title: { equals: REVALUATION_EXPENSE_TITLE, mode: "insensitive" } },
        { title: { equals: "ПЕРЕОЦЕНКА", mode: "insensitive" } },
      ],
      spentAt: {
        gte: new Date(Date.UTC(input.year, input.month - 1, 1)),
        lt: new Date(Date.UTC(input.year, input.month, 1)),
      },
    },
  });
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
 * Natija faqat Revaluation jadvaliga va jurnalga yoziladi — harajatga emas.
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

  // Oy jami faqat jurnal uchun. Harajatga YOZILMAYDI: F-Apteka bilan
  // solishtirganda (28.09) farq chiqdi — SITE.exe bir doriga bitta narx
  // yuboradi, F-Apteka esa har partiyani alohida qayta baholaydi, SITE.exe
  // to'xtab qolsa hujjat umuman tushmaydi. Aniq summa oy oxirida Moliya
  // formasidagi "Qayta baholash" ga F-Apteka'dan qo'lda kiritiladi.
  const { start, end } = tashkentMonth(new Date());
  for (const unit of byUnit.keys()) {
    const sum = await db.revaluation.aggregate({
      _sum: { amount: true },
      where: { unit, at: { gte: start, lt: end } },
    });
    result.monthTotals.push({ unit, amount: Math.max(0, -Number(sum._sum.amount ?? 0)) });
  }
  return result;
}

/** F-Apteka bazasidan kelgan pereotsenka: kun × otdel jamlanmasi */
export type RevaluationDbRow = {
  /** Sana, yyyy-mm-dd */
  D?: string;
  /** F-Apteka otdel: 2 = Yunusobod, 3 = Shayxontohur */
  OTD?: string;
  /** Hujjatlar soni */
  N?: string;
  /** "Сумма" — Цена розничная bo'yicha */
  S?: string;
  /** "Сумма 1" — Цена розничная 1 bo'yicha (asosiy) */
  S1?: string;
};

/** DailySales'da pereotsenka shu docType bilan turadi: amount = Сумма 1, cost = Сумма */
export const REVALUATION_DOC_TYPE = "REVAL";

const toNumber = (value: unknown) => {
  const n = Number(String(value ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Pereotsenka F-Apteka bazasidan (NGLOBAL: REVAL + REVALLN, STATE = 12).
 *
 * Relay skript oy bo'yicha kun × otdel jamlanmasini yuboradi. Summa
 * F-Apteka "Переоценка" oynasidagi bilan tiyinigacha bir xil (28.09.2026
 * da hujjatma-hujjat tekshirilgan). SITE.exe narxlaridan hisoblangan
 * taxminiy summa o'rniga shu ishlatiladi.
 *
 * Oraliqdagi eski yozuvlar almashtiriladi (hujjat o'chirilgan bo'lsa ham
 * to'g'ri chiqadi). Oy jami — zarar musbat — MonthlyFinance.revaluation ga
 * ("Qayta baholash" qatori) yoziladi; harajat emas, sof foydadan ayirilmaydi.
 */
export async function syncRevaluationFromDb(input: { rows: RevaluationDbRow[]; dateFrom: string; dateTo: string }) {
  const units = otdelUnitMap();
  const from = new Date(`${input.dateFrom}T00:00:00Z`);
  const to = new Date(new Date(`${input.dateTo}T00:00:00Z`).getTime() + 864e5);

  // kun × dorixona
  const byDay = new Map<string, { day: Date; unit: string; amount: number; cost: number }>();
  let skipped = 0;
  for (const row of input.rows) {
    const unit = units.get(String(row.OTD ?? "").trim());
    const day = String(row.D ?? "").slice(0, 10);
    if (!unit || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      skipped += 1;
      continue;
    }
    const key = `${day}|${unit}`;
    const entry = byDay.get(key) ?? { day: new Date(`${day}T00:00:00Z`), unit, amount: 0, cost: 0 };
    entry.amount += toNumber(row.S1);
    entry.cost += toNumber(row.S);
    byDay.set(key, entry);
  }

  const unitNames = [...new Set(units.values())];
  await db.$transaction([
    db.dailySales.deleteMany({
      where: { docType: REVALUATION_DOC_TYPE, unit: { in: unitNames }, day: { gte: from, lt: to } },
    }),
    db.dailySales.createMany({
      data: [...byDay.values()].map((e) => ({
        day: e.day,
        unit: e.unit,
        docType: REVALUATION_DOC_TYPE,
        amount: Math.round(e.amount * 100) / 100,
        cost: Math.round(e.cost * 100) / 100,
      })),
    }),
  ]);

  // Oraliqqa tushgan har oy × dorixona uchun oy jami
  const branch = await db.branch.findFirst({ where: { isActive: true } });
  const totals: { unit: string; month: string; loss: number }[] = [];
  if (branch) {
    for (let cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1)); cursor < to; ) {
      const next = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
      for (const unit of unitNames) {
        const sum = await db.dailySales.aggregate({
          _sum: { amount: true },
          where: { docType: REVALUATION_DOC_TYPE, unit, day: { gte: cursor, lt: next } },
        });
        // Narx tushsa "Сумма 1" manfiy — bu zarar, kartada musbat ko'rinadi
        const loss = Math.round(-Number(sum._sum.amount ?? 0) * 100) / 100;
        await db.monthlyFinance.upsert({
          where: { unit_periodMonth: { unit, periodMonth: cursor } },
          create: { unit, periodMonth: cursor, branchId: branch.id, revaluation: loss },
          update: { revaluation: loss },
        });
        totals.push({ unit, month: cursor.toISOString().slice(0, 7), loss });
      }
      cursor = next;
    }
  }

  return { days: byDay.size, skipped, totals };
}
