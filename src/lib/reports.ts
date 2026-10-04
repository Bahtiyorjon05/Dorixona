import { getExpensesData, getKpiData, getPriceWatchData } from "@/lib/queries";
import { formatDate, formatTime, monthName } from "@/lib/format";
import { db } from "@/lib/db";
import { overlayRetail } from "@/lib/monthly-finance";
import { currentWorkDay, getCashierData, todayShiftsByEmployee } from "@/lib/cashiers";

export type ReportData = {
  filename: string;
  sheet: string;
  title: string;
  columns: string[];
  rows: (string | number)[][];
};

export const REPORTS = ["kpi", "finance", "attendance", "narxlar", "harajatlar", "kassirlar"] as const;
export type ReportKind = (typeof REPORTS)[number];

const EXPENSE_CATEGORY: Record<string, string> = {
  RENT: "Ijara",
  UTILITIES: "Kommunal",
  GOODS: "Tovar",
  SALARY: "Oylik",
  LICENSE: "Soliq / litsenziya",
  OTHER: "Boshqa",
};

export async function buildReport(kind: ReportKind, options: { month?: Date } = {}): Promise<ReportData> {
  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  if (kind === "harajatlar") {
    // Tanlangan oyning harajatlari, dorixona bo'yicha, har birining jami bilan.
    // Tovar xaridi harajatga kirmaydi — oxirida bitta qatorda ko'rsatiladi.
    const d = await getExpensesData(options.month);
    const period = `${d.period.getFullYear()}-${String(d.period.getMonth() + 1).padStart(2, "0")}`;
    const items = d.list.filter((e) => e.category !== "GOODS");
    const units = [...new Set(items.map((e) => e.unit ?? "Umumiy (filialsiz)"))].sort();

    const rows: (string | number)[][] = [];
    for (const unit of units) {
      const own = items
        .filter((e) => (e.unit ?? "Umumiy (filialsiz)") === unit)
        .sort((a, b) => b.amount - a.amount);
      for (const e of own) {
        const day = new Date(e.spentAt);
        rows.push([
          unit,
          `${String(day.getDate()).padStart(2, "0")}.${String(day.getMonth() + 1).padStart(2, "0")}.${day.getFullYear()}`,
          e.title,
          EXPENSE_CATEGORY[e.category] ?? e.category,
          e.isRecurring ? "Doimiy" : "",
          Math.round(e.amount),
        ]);
      }
      rows.push([unit, "", `JAMI — ${unit}`, "", "", Math.round(own.reduce((sum, e) => sum + e.amount, 0))]);
      rows.push(["", "", "", "", "", ""]);
    }
    rows.push(["", "", "JAMI HARAJAT", "", "", Math.round(items.reduce((sum, e) => sum + e.amount, 0))]);
    if (d.goods > 0) {
      rows.push(["", "", "Tovar xaridi (harajatga kirmaydi)", "Tovar", "", Math.round(d.goods)]);
    }

    return {
      filename: `harajatlar-${period}`,
      sheet: "Harajatlar",
      title: `${d.period.getFullYear()}-yil ${monthName(d.period.getMonth() + 1)} harajatlari`,
      columns: ["Dorixona", "Sana", "Nomi", "Toifa", "Turi", "Summa (so'm)"],
      rows,
    };
  }

  if (kind === "narxlar") {
    // Narxni tushirish kerak bo'lganlar: tavsiyadan qimmat turgan dorilar.
    // Ro'yxat F-Apteka'da qo'lda tuzatish uchun - eng ko'p farqlisi tepada.
    const [slow, top] = await Promise.all([
      getPriceWatchData({ group: "slow", page: 1 }),
      getPriceWatchData({ group: "top", page: 1 }),
    ]);
    const rows = [...slow.items, ...top.items]
      .filter((item) => (item.diff ?? 0) > 0)
      .sort((a, b) => (b.diff ?? 0) - (a.diff ?? 0));

    return {
      filename: `narx-tuzatish-${stamp}`,
      sheet: "Narxlar",
      title: "Narxni tushirish kerak bo'lgan dorilar",
      columns: [
        "Dori",
        "Guruh",
        "Sotilgan (dona/oy)",
        "Qoldiq",
        "Tan narx",
        "Hozirgi narx",
        "Asos",
        "Ustama %",
        "Tavsiya narx",
        "Farq",
      ],
      rows: rows.map((item) => [
        item.name,
        item.group === "top" ? "Topiviy" : "Kam sotilayotgan",
        item.perMonth,
        item.stock,
        Math.round(item.cost),
        Math.round(item.our),
        item.basis === "competitor" ? "Arzonapteka" : "Tan narx",
        item.percent,
        item.suggested ?? 0,
        Math.round(item.diff ?? 0),
      ]),
    };
  }

  if (kind === "kpi") {
    const d = await getKpiData();
    return {
      filename: `kpi-hisobot-${stamp}`,
      sheet: "KPI",
      title: `KPI hisoboti — ${monthName(d.month)} ${d.year}`,
      columns: ["Xodim", "Lavozim", "Savdo", "Marja", "Davomat", "Intizom", "Mijoz", "Jami ball", "Bonus %", "Bonus (so'm)"],
      rows: d.ranking.map((r) => [
        r.name,
        r.position,
        r.components.sales,
        r.components.margin,
        r.components.attendance,
        r.components.discipline,
        r.components.customer,
        r.total,
        r.bonusPercent,
        r.bonusAmount,
      ]),
    };
  }

  if (kind === "finance") {
    // Shu yil, oy x dorixona: savdo va foyda F-Apteka jamlanmasidan (overlayRetail),
    // harajat tovar xaridisiz, sof foyda = foyda - harajat.
    const year = now.getFullYear();
    const from = new Date(Date.UTC(year, 0, 1));
    const to = new Date(Date.UTC(year + 1, 0, 1));
    const [fin, spent] = await Promise.all([
      db.monthlyFinance.findMany({ where: { periodMonth: { gte: from, lt: to } }, orderBy: [{ periodMonth: "asc" }, { unit: "asc" }] }),
      db.expense.findMany({
        where: { spentAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) }, category: { not: "GOODS" } },
        select: { spentAt: true, unit: true, amount: true },
      }),
    ]);
    await overlayRetail(fin);
    const spentBy = new Map<string, number>();
    for (const e of spent) {
      const key = `${e.spentAt.getUTCFullYear()}-${e.spentAt.getUTCMonth() + 1}|${e.unit ?? "Umumiy"}`;
      spentBy.set(key, (spentBy.get(key) ?? 0) + Number(e.amount));
    }
    const rows = fin.map((f) => {
      const m = new Date(f.periodMonth);
      const expenses = spentBy.get(`${m.getUTCFullYear()}-${m.getUTCMonth() + 1}|${f.unit}`) ?? 0;
      const profit = Number(f.profit);
      return [
        `${monthName(m.getUTCMonth() + 1)} ${m.getUTCFullYear()}`,
        f.unit,
        Math.round(Number(f.turnover)),
        Math.round(profit),
        Math.round(expenses),
        Math.round(profit - expenses),
        Math.round(Number(f.revaluation)),
        Math.round(Number(f.stockValue)),
      ];
    });
    return {
      filename: `moliya-hisobot-${year}`,
      sheet: "Moliya",
      title: `Moliyaviy hisobot — ${year}-yil, oylar va dorixonalar bo'yicha (so'm)`,
      columns: ["Oy", "Dorixona", "Savdo", "Foyda (QQSsiz)", "Harajat", "Sof foyda", "Qayta baholash", "Qoldiq"],
      rows,
    };
  }

  if (kind === "kassirlar") {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const data = await getCashierData({ from: monthStart, to: now, unit: null });
    return {
      filename: `kassirlar-${stamp}`,
      sheet: "Smenalar",
      title: `Kassirlar va smenalar — ${monthName(now.getMonth() + 1)} ${now.getFullYear()}`,
      columns: ["Sana", "Dorixona", "Kassir", "Ochildi", "Yopildi", "Soat", "Chek", "Savdo"],
      rows: [
        ...[...data.shifts].reverse().map((s) => [
          formatDate(s.openedAt),
          s.unit,
          s.cashier,
          formatTime(s.openedAt),
          formatTime(s.closedAt),
          Math.round(s.hours * 10) / 10,
          s.checks,
          Math.round(s.net),
        ]),
        ["", "", "", "", "", "", "", ""],
        ...data.cashiers.map((c) => [
          "JAMI",
          c.unit,
          c.cashier,
          `${c.days} kun`,
          `${c.shifts} smena`,
          Math.round(c.hours * 10) / 10,
          c.checks,
          Math.round(c.net),
        ]),
      ],
    };
  }

  // attendance — shu oy, kunma-kun: kelish = smena ochilishi (bo'lmasa qo'lda), kassa yopish
  const STATUS: Record<string, string> = {
    PRESENT: "Keldi",
    LATE: "Kechikdi",
    ABSENT: "Kelmadi",
    ON_LEAVE: "Ta'tilda",
  };
  const today = currentWorkDay(now);
  const monthPrefix = today.slice(0, 8);
  const lastDay = Number(today.slice(8, 10));
  const employees = await db.employee.findMany({
    where: { status: { not: "INACTIVE" } },
    select: { id: true, fullName: true, unit: true },
    orderBy: { fullName: "asc" },
  });
  const monthAttendance = await db.attendance.findMany({
    where: { date: { gte: new Date(`${monthPrefix}01T00:00:00Z`) } },
  });
  const manual = new Map(monthAttendance.map((a) => [`${a.employeeId}|${a.date.toISOString().slice(0, 10)}`, a]));
  const rows: (string | number)[][] = [];
  for (let dayNo = 1; dayNo <= lastDay; dayNo++) {
    const day = `${monthPrefix}${String(dayNo).padStart(2, "0")}`;
    const shifts = await todayShiftsByEmployee(employees, day);
    for (const e of employees) {
      const shift = shifts.byEmployee[e.id];
      const record = manual.get(`${e.id}|${day}`);
      if (!shift && !record) continue;
      const status = record ? (STATUS[record.status] ?? record.status) : shift?.active ? "Smenada" : "Smena tugadi";
      rows.push([
        day.split("-").reverse().join("."),
        e.fullName,
        shift?.unit ?? e.unit ?? "",
        shift ? formatTime(shift.opened) : record?.checkIn ? formatTime(record.checkIn) : "—",
        shift ? (shift.active ? "ochiq" : formatTime(shift.closed)) : "—",
        status,
        record?.lateMinutes ?? 0,
        record?.penalty ?? 0,
      ]);
    }
  }
  return {
    filename: `davomat-${stamp}`,
    sheet: "Davomat",
    title: `Davomat — ${monthName(now.getMonth() + 1)} ${now.getFullYear()}`,
    columns: ["Sana", "Xodim", "Dorixona", "Kelish", "Kassa yopish", "Holat", "Kechikish (daq)", "Penalti (ball)"],
    rows,
  };
}
