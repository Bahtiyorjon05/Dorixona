import "server-only";
import { db } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  DEBT_DUE_SOON_DAYS,
  DEBT_URGENT_DAYS,
  getPriceWatchData,
  paymentBreakdown,
  salesSplit,
} from "@/lib/queries";

/**
 * Telegram uchun tayyor xabarlar. Bot buyruqlari ham, kunlik eslatma ham
 * shu yerdan matn oladi — ikkisi bir xil ko'rinishda bo'lsin.
 *
 * Ranglar saytdagi bilan bir xil: qizil — muddat o'tgan yoki 10 kundan kam
 * qolgan, sariq — 20 kundan kam qolgan.
 */

const num = (value: unknown) => Number(value ?? 0);

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function som(value: number) {
  return Math.round(value).toLocaleString("ru-RU").replace(/,/g, " ");
}

export function money(value: number, currency: "UZS" | "USD" | string = "UZS") {
  return currency === "USD" ? `$${som(value)}` : `${som(value)} so'm`;
}

/** HTML parse_mode uchun xavfsiz matn */
function esc(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export type DebtRow = {
  id: string;
  counterparty: string;
  kind: "FIRM" | "STREET";
  currency: "UZS" | "USD";
  direction: "PAYABLE" | "RECEIVABLE";
  remaining: number;
  dueDate: Date | null;
  days: number | null;
  unit: string | null;
};

export type DebtSummary = {
  ok: boolean;
  /** Jadval hali yaratilmagan bo'lsa */
  needsMigration: boolean;
  openCount: number;
  withDueDate: number;
  overdue: DebtRow[];
  urgent: DebtRow[];
  soon: DebtRow[];
  later: DebtRow[];
  noDueDate: DebtRow[];
  totals: { firmUzs: number; firmUsd: number; streetUzs: number; streetUsd: number };
};

/** Ochiq qarzlarni muddati bo'yicha guruhlaydi */
export async function debtSummary(): Promise<DebtSummary> {
  const empty: DebtSummary = {
    ok: false,
    needsMigration: true,
    openCount: 0,
    withDueDate: 0,
    overdue: [],
    urgent: [],
    soon: [],
    later: [],
    noDueDate: [],
    totals: { firmUzs: 0, firmUsd: 0, streetUzs: 0, streetUsd: 0 },
  };

  let rows;
  try {
    rows = await db.debt.findMany({
      where: { closedAt: null },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        counterparty: true,
        kind: true,
        currency: true,
        direction: true,
        totalAmount: true,
        paidAmount: true,
        dueDate: true,
        unit: true,
      },
    });
  } catch {
    return empty;
  }

  const today = startOfDay();
  const open: DebtRow[] = rows
    .map((debt) => {
      const remaining = num(debt.totalAmount) - num(debt.paidAmount);
      const due = debt.dueDate ? new Date(debt.dueDate) : null;
      return {
        id: debt.id,
        counterparty: debt.counterparty,
        kind: debt.kind as "FIRM" | "STREET",
        currency: debt.currency as "UZS" | "USD",
        direction: debt.direction as "PAYABLE" | "RECEIVABLE",
        remaining,
        dueDate: due,
        days: due === null ? null : Math.round((startOfDay(due).getTime() - today.getTime()) / 864e5),
        unit: debt.unit,
      };
    })
    .filter((debt) => debt.remaining > 0.009);

  const sumBy = (kind: "FIRM" | "STREET", currency: "UZS" | "USD") =>
    open
      .filter((debt) => debt.kind === kind && debt.currency === currency)
      .reduce((sum, debt) => sum + debt.remaining, 0);

  return {
    ok: true,
    needsMigration: false,
    openCount: open.length,
    withDueDate: open.filter((debt) => debt.days !== null).length,
    overdue: open.filter((debt) => debt.days !== null && debt.days < 0),
    urgent: open.filter((debt) => debt.days !== null && debt.days >= 0 && debt.days <= DEBT_URGENT_DAYS),
    soon: open.filter(
      (debt) => debt.days !== null && debt.days > DEBT_URGENT_DAYS && debt.days <= DEBT_DUE_SOON_DAYS,
    ),
    later: open.filter((debt) => debt.days !== null && debt.days > DEBT_DUE_SOON_DAYS),
    noDueDate: open.filter((debt) => debt.days === null),
    totals: {
      firmUzs: sumBy("FIRM", "UZS"),
      firmUsd: sumBy("FIRM", "USD"),
      streetUzs: sumBy("STREET", "UZS"),
      streetUsd: sumBy("STREET", "USD"),
    },
  };
}

function debtLine(debt: DebtRow) {
  const days = debt.days;
  const when =
    days === null
      ? "muddat qo'yilmagan"
      : days < 0
        ? `${Math.abs(days)} kun o'tdi`
        : days === 0
          ? "bugun"
          : `${days} kun qoldi`;
  const who = debt.direction === "PAYABLE" ? "" : " (bizga qarzdor)";
  const place = debt.unit ? ` · ${debt.unit}` : "";
  return `• <b>${esc(debt.counterparty)}</b> — ${money(debt.remaining, debt.currency)} (${when})${who}${place}`;
}

function debtBlock(title: string, rows: DebtRow[], limit = 10) {
  if (!rows.length) return "";
  const lines = rows.slice(0, limit).map(debtLine);
  const more = rows.length > limit ? `\n… yana ${rows.length - limit} ta` : "";
  return `\n${title}\n${lines.join("\n")}${more}`;
}

/**
 * Kunlik eslatma matni. Ogohlantirish yo'q bo'lsa null qaytaradi —
 * bekorga xabar yubormaymiz.
 */
export function debtAlertMessage(summary: DebtSummary) {
  const red = [...summary.overdue, ...summary.urgent];
  if (!red.length && !summary.soon.length) return null;

  const head = `🧮 <b>Qarz eslatmasi</b>`;
  const body =
    debtBlock(`🔴 Shoshilinch (${red.length} ta):`, red) + debtBlock(`🟡 Muddati yaqin (${summary.soon.length} ta):`, summary.soon);
  const foot = `\n\nJami ochiq qarz: ${summary.openCount} ta`;
  return head + body + foot;
}

/** /qarzlar buyrug'i uchun — har doim matn qaytaradi */
export async function debtMessage() {
  const summary = await debtSummary();
  if (summary.needsMigration) {
    return "Qarzlar jadvali hali yaratilmagan. Supabase'da <code>prisma/manual/qarzlar.sql</code> ni ishga tushirish kerak.";
  }
  if (!summary.openCount) {
    return "🧮 <b>Qarzlar</b>\n\nOchiq qarz yo'q — hammasi yopilgan ✅";
  }

  const t = summary.totals;
  const totals = [
    t.firmUzs > 0 ? `Firma: ${money(t.firmUzs)}` : "",
    t.firmUsd > 0 ? `Firma: ${money(t.firmUsd, "USD")}` : "",
    t.streetUzs > 0 ? `Ko'cha: ${money(t.streetUzs)}` : "",
    t.streetUsd > 0 ? `Ko'cha: ${money(t.streetUsd, "USD")}` : "",
  ].filter(Boolean);

  const red = [...summary.overdue, ...summary.urgent];
  const parts = [
    `🧮 <b>Qarzlar</b> — ${summary.openCount} ta ochiq`,
    totals.length ? `\n${totals.join("\n")}` : "",
    debtBlock(`\n🔴 Shoshilinch (${red.length} ta):`, red),
    debtBlock(`\n🟡 Muddati yaqin (${summary.soon.length} ta):`, summary.soon),
    debtBlock(`\n⚪ Muddati keyin (${summary.later.length} ta):`, summary.later, 5),
    summary.noDueDate.length ? `\n\n📅 Muddat qo'yilmagan: ${summary.noDueDate.length} ta` : "",
  ];

  return parts.filter(Boolean).join("\n");
}

/** /savdo — bugun va kechagi savdo, naqd/karta ajratilgan holda */
export async function salesMessage() {
  const today = startOfDay();
  const tomorrow = new Date(today.getTime() + 864e5);
  const yesterday = new Date(today.getTime() - 864e5);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  const [todaySplit, yesterdaySplit, monthSplit, todayPay, monthPay, todayUnits] = await Promise.all([
    salesSplit(today, tomorrow, null),
    salesSplit(yesterday, today, null),
    salesSplit(monthStart, nextMonth, null),
    paymentBreakdown(today, tomorrow, null),
    paymentBreakdown(monthStart, nextMonth, null),
    db.dailySales
      .groupBy({
        by: ["unit"],
        _sum: { amount: true },
        where: { day: { gte: today, lt: tomorrow }, NOT: { docType: { startsWith: "PAY:" } } },
      })
      .catch(() => []),
  ]);

  const diff = yesterdaySplit.net > 0 ? ((todaySplit.net - yesterdaySplit.net) / yesterdaySplit.net) * 100 : null;
  const trend = diff === null ? "" : ` (${diff >= 0 ? "+" : ""}${diff.toFixed(0)}% kechagiga nisbatan)`;

  const unitLines = todayUnits
    .map((row) => ({ unit: row.unit ?? "Umumiy", amount: num(row._sum.amount) }))
    .filter((row) => row.amount !== 0)
    .sort((a, b) => b.amount - a.amount)
    .map((row) => `• ${esc(row.unit)}: ${money(row.amount)}`);

  const payLine = (label: string, pay: Awaited<ReturnType<typeof paymentBreakdown>>) =>
    pay.known
      ? `${label}: ${pay.items.map((item) => `${esc(item.label)} ${som(item.amount)}`).join(" · ")}`
      : "";

  const parts = [
    `🛒 <b>Savdo</b>`,
    `\nBugun: <b>${money(todaySplit.net)}</b>${trend}`,
    todaySplit.refunds > 0 ? `Qaytarilgan: ${money(todaySplit.refunds)}` : "",
    unitLines.length ? `\n${unitLines.join("\n")}` : "",
    payLine("\nBugun to'lov turlari", todayPay),
    `\nOy boshidan: <b>${money(monthSplit.net)}</b>`,
    payLine("Oylik to'lov turlari", monthPay),
  ];

  if (!todaySplit.known) {
    parts.push("\n\n⚠️ F-Apteka'dan bugungi ma'lumot hali kelmagan.");
  }

  return parts.filter(Boolean).join("\n");
}

/** Shuncha kun ichida sotilgan bo'lsa — tugagani ogohlantirishga kiradi */
const SOLD_OUT_RECENT_DAYS = 30;

/**
 * Tugagan tovar: qoldig'i 0 va oxirgi 30 kunda sotilgan.
 *
 * Ikki shart ham kerak. Faqat "qoldiq 0" desa mingdan ortiq chiqadi —
 * ularning ko'pi bir vaqtlar kelgan-u, qayta buyurtma qilinmaydigan
 * dorilar. Faqat "kam qoldiq" desa yana ko'payib ketadi: dorixonada
 * dorining qoldig'i tabiiy ravishda kichik. Yaqinda sotilgani tugasa
 * esa mijoz so'raydi — buyurtma berish kerak.
 */
function soldOutWhere() {
  const since = new Date(Date.now() - SOLD_OUT_RECENT_DAYS * 864e5);
  return {
    isActive: true,
    stock: 0,
    saleItems: { some: { sale: { createdAt: { gte: since } } } },
  };
}

/** /ombor — kam qoldiq va muddati yaqin dorilar */
export async function stockMessage() {
  const soon = new Date(Date.now() + 60 * 864e5);
  const [total, valueRows, low, expiring] = await Promise.all([
    db.product.count({ where: { isActive: true } }),
    db.$queryRaw<{ value: number }[]>`
      SELECT COALESCE(SUM(stock * "costPrice"), 0)::float8 AS value FROM "Product" WHERE "isActive" = true`,
    db.product.findMany({
      where: soldOutWhere(),
      orderBy: { stock: "asc" },
      take: 10,
      select: { name: true, stock: true, minStock: true },
    }),
    db.product.findMany({
      where: { isActive: true, expiryDate: { not: null, lte: soon }, stock: { gt: 0 } },
      orderBy: { expiryDate: "asc" },
      take: 8,
      select: { name: true, expiryDate: true, stock: true },
    }),
  ]);

  const parts = [
    `📦 <b>Ombor</b>`,
    `\nTovar turi: ${som(total)} ta`,
    `Ombor qiymati: ${money(num(valueRows[0]?.value))}`,
    low.length
      ? `\n🔴 Tugagan:\n${low.map((p) => `• ${esc(p.name)}`).join("\n")}`
      : "\n✅ Tugagan dori yo'q",
    expiring.length
      ? `\n🟡 Muddati yaqin (60 kun):\n${expiring
          .map((p) => `• ${esc(p.name)} — ${p.expiryDate ? formatDate(p.expiryDate) : "-"}`)
          .join("\n")}`
      : "",
  ];

  return parts.filter(Boolean).join("\n");
}

/** /narxlar — ombordagi hamma dori bo'yicha qisqacha */
export async function priceMessage() {
  let settings;
  try {
    settings = await db.priceSetting.findMany({ orderBy: { unit: "asc" } });
  } catch {
    return "Narx nazorati jadvali hali yaratilmagan. Supabase'da <code>prisma/manual/narx-nazorati.sql</code> ni ishga tushirish kerak.";
  }

  const [slow, top] = await Promise.all([
    getPriceWatchData({ group: "slow" }),
    getPriceWatchData({ group: "top" }),
  ]);

  // Qimmat turganlar - sahifadagi birinchi 50 tadan; to'lig'i saytda
  const overpriced = slow.items
    .filter((item) => (item.diff ?? 0) > 0)
    .sort((a, b) => (b.diff ?? 0) - (a.diff ?? 0));

  const settingLines = settings.map(
    (s) => `• ${esc(s.unit)}: ${s.enabled ? `yoqilgan, ${num(s.percent)}%` : "o'chirilgan"}`,
  );

  const parts = [
    `💹 <b>Narx nazorati</b>`,
    `\nOmborda: ${som(slow.total)} ta dori`,
    `🐌 Kam sotilayotgan: ${som(slow.slowCount)} ta · 🔥 topiviy: ${som(slow.topCount)} ta`,
    `Arzonaptekadan narx olinadi: ${som(slow.competitorCount)} ta`,
    settingLines.length ? `\n${settingLines.join("\n")}` : "",
    overpriced.length
      ? `\n⚠️ Narxni tushirish kerak (kam sotilayotganlardan):\n${overpriced
          .slice(0, 10)
          .map(
            (item) =>
              `• ${esc(item.name)} — bizda ${som(item.our)}, tavsiya ${som(item.suggested ?? 0)}`,
          )
          .join("\n")}`
      : "\n✅ Kam sotilayotganlarda tavsiyadan qimmati yo'q",
    top.items.length
      ? `\n🔥 Eng ko'p sotilayotgan:\n${top.items
          .slice(0, 5)
          .map((item) => `• ${esc(item.name)} — ${item.perMonth.toFixed(0)} dona/oy`)
          .join("\n")}`
      : "",
    slow.lastChecked
      ? `\nOxirgi tekshiruv: ${formatDateTime(slow.lastChecked)}`
      : "\nHali tekshirilmagan",
  ];

  return parts.filter(Boolean).join("\n");
}

/** /hisobot — bir xabarda kunlik jamlanma */
export async function digestMessage() {
  const today = startOfDay();
  const tomorrow = new Date(today.getTime() + 864e5);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  const [todaySplit, monthSplit, pay, expenses, debts, low] = await Promise.all([
    salesSplit(today, tomorrow, null),
    salesSplit(monthStart, nextMonth, null),
    paymentBreakdown(today, tomorrow, null),
    // Tovar xaridi harajatga kirmaydi — tan narxi foyda ichida ayirilgan
    db.expense.aggregate({
      _sum: { amount: true },
      where: { spentAt: { gte: monthStart, lt: nextMonth }, category: { not: "GOODS" } },
    }),
    debtSummary(),
    // Tugagan tovar: soldOutWhere() da izohlangan ikki shart bo'yicha
    db.product.count({ where: soldOutWhere() }),
  ]);

  const red = debts.overdue.length + debts.urgent.length;
  const parts = [
    `📊 <b>Kunlik jamlanma</b> — ${formatDate(today)}`,
    `\nBugungi savdo: <b>${money(todaySplit.net)}</b>`,
    pay.known ? `Naqd ${som(pay.cash)} · Karta ${som(pay.card)}` : "",
    `Oy boshidan: ${money(monthSplit.net)}`,
    `Oylik xarajat: ${money(num(expenses._sum.amount))}`,
    `\nOchiq qarz: ${debts.openCount} ta${red ? ` · 🔴 shoshilinch ${red} ta` : ""}${debts.soon.length ? ` · 🟡 ${debts.soon.length} ta` : ""}`,
    low ? `Tugagan: ${som(low)} ta dori` : "Tugagan dori yo'q",
  ];

  return parts.filter(Boolean).join("\n");
}

/**
 * Ombor ogohlantirishi — ertalabki xabar uchun.
 *
 * Aytadigan narsa bo'lmasa null: tugab qolgan ham, muddati yaqin ham
 * bo'lmasa bekorga xabar yubormaymiz.
 */
export async function stockAlert() {
  const soon = new Date(Date.now() + 30 * 864e5);
  // Ogohlantirish tugab qolgan tovar bo'yicha — qoldig'i oz va yaqinda
  // sotilgan. Sharti soldOutWhere() da izohlangan.
  const [lowCount, low, expiringCount, expiring] = await Promise.all([
    db.product.count({ where: soldOutWhere() }),
    db.product.findMany({
      where: soldOutWhere(),
      orderBy: { name: "asc" },
      take: 15,
      select: { name: true },
    }),
    db.product.count({
      where: { isActive: true, expiryDate: { not: null, lte: soon }, stock: { gt: 0 } },
    }),
    db.product.findMany({
      where: { isActive: true, expiryDate: { not: null, lte: soon }, stock: { gt: 0 } },
      orderBy: { expiryDate: "asc" },
      take: 10,
      select: { name: true, expiryDate: true, stock: true },
    }),
  ]);

  if (!lowCount && !expiringCount) {
    return { text: null, low: 0, expiring: 0 };
  }

  // Ro'yxat qirqilgan bo'lsa aytib qo'yamiz, aks holda sarlavhadagi son
  // ko'rsatilgan qatorlar soniga o'xshab ketadi
  const more = (shown: number, total: number) =>
    total > shown ? `\n… yana ${som(total - shown)} ta` : "";

  const parts = [
    "📦 <b>Ombor ogohlantirishi</b>",
    lowCount
      ? `\n🔴 Tugagan (${som(lowCount)} ta):\n${low.map((p) => `• ${esc(p.name)}`).join("\n")}` +
        more(low.length, lowCount)
      : "",
    expiringCount
      ? `\n🟡 Muddati 30 kun ichida (${som(expiringCount)} ta):\n${expiring
          .map((p) => `• ${esc(p.name)} — ${p.expiryDate ? formatDate(p.expiryDate) : "-"} · ${p.stock} dona`)
          .join("\n")}` + more(expiring.length, expiringCount)
      : "",
  ];

  return { text: parts.filter(Boolean).join("\n"), low: lowCount, expiring: expiringCount };
}

/**
 * Ombor mezonini tanlash uchun: har xil shartda nechta dori chiqishini
 * sanaydi. Faqat tekshiruv rejimida chaqiriladi — oddiy ishda keraksiz
 * so'rov qilmaymiz.
 */
export async function stockRuleCounts() {
  const since = (days: number) => new Date(Date.now() - days * 864e5);
  const rule = (stock: number, days: number) => ({
    isActive: true,
    stock: stock === 0 ? 0 : { lte: stock },
    saleItems: { some: { sale: { createdAt: { gte: since(days) } } } },
  });

  const [nol30, nol60, kam1_30, kam3_30, kam3_60, faqatNol, faqatKam3] = await Promise.all([
    db.product.count({ where: rule(0, 30) }),
    db.product.count({ where: rule(0, 60) }),
    db.product.count({ where: rule(1, 30) }),
    db.product.count({ where: rule(3, 30) }),
    db.product.count({ where: rule(3, 60) }),
    db.product.count({ where: { isActive: true, stock: 0 } }),
    db.product.count({ where: { isActive: true, stock: { lte: 3 } } }),
  ]);

  // Tez sotiladiganlarni ajratish: oxirgi 30 kunda kamida shuncha dona
  const fast = async (stock: number, minQty: number) => {
    const rows = await db.$queryRaw<{ soni: number }[]>`
      SELECT COUNT(*)::float8 AS soni FROM (
        SELECT p.id
        FROM "Product" p
        JOIN "SaleItem" si ON si."productId" = p.id
        JOIN "Sale" s ON s.id = si."saleId"
        WHERE p."isActive" = true AND p.stock <= ${stock} AND s."createdAt" >= ${since(30)}
        GROUP BY p.id
        HAVING SUM(si.quantity) >= ${minQty}
      ) x`;
    return Math.round(Number(rows[0]?.soni ?? 0));
  };

  const [tez3_10, tez3_20, tez3_30, tez1_10] = await Promise.all([
    fast(3, 10),
    fast(3, 20),
    fast(3, 30),
    fast(1, 10),
  ]);

  return {
    "qoldiq 0 + 30 kun": nol30,
    "qoldiq 0 + 60 kun": nol60,
    "qoldiq <=1 + 30 kun": kam1_30,
    "qoldiq <=3 + 30 kun": kam3_30,
    "qoldiq <=3 + 60 kun": kam3_60,
    "qoldiq <=3 + oyiga 10+ dona": tez3_10,
    "qoldiq <=3 + oyiga 20+ dona": tez3_20,
    "qoldiq <=3 + oyiga 30+ dona": tez3_30,
    "qoldiq <=1 + oyiga 10+ dona": tez1_10,
    "faqat qoldiq 0 (savdosiz)": faqatNol,
    "faqat qoldiq <=3 (savdosiz)": faqatKam3,
  };
}
