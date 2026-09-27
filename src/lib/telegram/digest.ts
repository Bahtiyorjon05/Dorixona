import "server-only";
import { db } from "@/lib/db";
import { DEBT_DUE_SOON_DAYS, DEBT_URGENT_DAYS, paymentBreakdown, salesSplit } from "@/lib/queries";

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

/** /ombor — kam qoldiq va muddati yaqin dorilar */
export async function stockMessage() {
  const soon = new Date(Date.now() + 60 * 864e5);
  const [total, valueRows, low, expiring] = await Promise.all([
    db.product.count({ where: { isActive: true } }),
    db.$queryRaw<{ value: number }[]>`
      SELECT COALESCE(SUM(stock * "costPrice"), 0)::float8 AS value FROM "Product" WHERE "isActive" = true`,
    db.product.findMany({
      where: { isActive: true, stock: { lte: 5 } },
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
      ? `\n🔴 Kam qoldiq:\n${low.map((p) => `• ${esc(p.name)} — ${p.stock} dona`).join("\n")}`
      : "\n✅ Kam qoldiq yo'q",
    expiring.length
      ? `\n🟡 Muddati yaqin (60 kun):\n${expiring
          .map((p) => `• ${esc(p.name)} — ${p.expiryDate?.toLocaleDateString("uz-UZ") ?? "-"}`)
          .join("\n")}`
      : "",
  ];

  return parts.filter(Boolean).join("\n");
}

/** /narxlar — raqobatchidan qimmat turgan dorilar */
export async function priceMessage() {
  let rows;
  let settings;
  try {
    [rows, settings] = await Promise.all([
      db.priceWatch.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
      db.priceSetting.findMany({ orderBy: { unit: "asc" } }),
    ]);
  } catch {
    return "Narx nazorati jadvali hali yaratilmagan. Supabase'da <code>prisma/manual/narx-nazorati.sql</code> ni ishga tushirish kerak.";
  }

  const defaultPercent = settings.length ? num(settings[0].percent) : 5;
  const skus = rows.map((row) => row.sku).filter((sku): sku is string => Boolean(sku));
  const products = skus.length
    ? await db.product.findMany({
        where: { sku: { in: skus }, isActive: true },
        select: { sku: true, salePrice: true },
      })
    : [];
  const bySku = new Map(products.map((p) => [p.sku, num(p.salePrice)]));

  const items = rows.map((row) => {
    const competitor = row.competitorPrice === null ? null : num(row.competitorPrice);
    const percent = row.percent === null ? defaultPercent : num(row.percent);
    const suggested = competitor === null ? null : Math.round(competitor * (1 + percent / 100));
    const our = row.sku ? bySku.get(row.sku) ?? null : null;
    return { name: row.name, competitor, suggested, our, diff: our !== null && suggested !== null ? our - suggested : null };
  });

  const overpriced = items
    .filter((item) => (item.diff ?? 0) > 0)
    .sort((a, b) => (b.diff ?? 0) - (a.diff ?? 0));
  const lastChecked = rows.reduce<Date | null>(
    (latest, row) => (row.checkedAt && (!latest || row.checkedAt > latest) ? row.checkedAt : latest),
    null,
  );

  const settingLines = settings.map(
    (s) => `• ${esc(s.unit)}: ${s.enabled ? `yoqilgan, ${num(s.percent)}%` : "o'chirilgan"}`,
  );

  const parts = [
    `💹 <b>Narx nazorati</b>`,
    `\nKuzatiladi: ${rows.length} ta · narxi olingan: ${items.filter((i) => i.competitor !== null).length} ta`,
    settingLines.length ? `\n${settingLines.join("\n")}` : "",
    overpriced.length
      ? `\n⚠️ Narxni tushirish kerak (${overpriced.length} ta):\n${overpriced
          .slice(0, 10)
          .map(
            (item) =>
              `• ${esc(item.name)} — bizda ${som(item.our ?? 0)}, tavsiya ${som(item.suggested ?? 0)}`,
          )
          .join("\n")}`
      : "\n✅ Hammasi tavsiya narxdan past",
    lastChecked ? `\nOxirgi tekshiruv: ${lastChecked.toLocaleString("uz-UZ")}` : "\nHali tekshirilmagan",
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
    db.expense.aggregate({ _sum: { amount: true }, where: { spentAt: { gte: monthStart, lt: nextMonth } } }),
    debtSummary(),
    db.product.count({ where: { isActive: true, stock: { lte: 5 } } }),
  ]);

  const red = debts.overdue.length + debts.urgent.length;
  const parts = [
    `📊 <b>Kunlik jamlanma</b> — ${today.toLocaleDateString("uz-UZ")}`,
    `\nBugungi savdo: <b>${money(todaySplit.net)}</b>`,
    pay.known ? `Naqd ${som(pay.cash)} · Karta ${som(pay.card)}` : "",
    `Oy boshidan: ${money(monthSplit.net)}`,
    `Oylik xarajat: ${money(num(expenses._sum.amount))}`,
    `\nOchiq qarz: ${debts.openCount} ta${red ? ` · 🔴 shoshilinch ${red} ta` : ""}${debts.soon.length ? ` · 🟡 ${debts.soon.length} ta` : ""}`,
    low ? `Kam qoldiq: ${low} ta tovar` : "Kam qoldiq yo'q",
  ];

  return parts.filter(Boolean).join("\n");
}
