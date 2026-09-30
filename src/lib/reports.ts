import {
  getAttendanceData,
  getExpensesData,
  getFinanceData,
  getKpiData,
  getPriceWatchData,
} from "@/lib/queries";
import { formatTime, monthName } from "@/lib/format";

export type ReportData = {
  filename: string;
  sheet: string;
  title: string;
  columns: string[];
  rows: (string | number)[][];
};

export const REPORTS = ["kpi", "finance", "attendance", "narxlar", "harajatlar"] as const;
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
    const d = await getFinanceData();
    return {
      filename: `moliya-hisobot-${stamp}`,
      sheet: "Moliya",
      title: "Moliyaviy hisobot — 6 oylik (mln so'm)",
      columns: ["Oy", "Savdo (mln)", "Xarajat (mln)"],
      rows: d.profitSeries.map((p) => [p.label, p.savdo, p.xarajat]),
    };
  }

  // attendance
  const d = await getAttendanceData();
  const STATUS: Record<string, string> = {
    PRESENT: "Keldi",
    LATE: "Kechikdi",
    ABSENT: "Kelmadi",
    ON_LEAVE: "Ta'tilda",
  };
  return {
    filename: `davomat-hisobot-${stamp}`,
    sheet: "Davomat",
    title: "Bugungi davomat jadvali",
    columns: ["Xodim", "Holat", "Kelish vaqti", "Kechikish (daq)", "Penalti (ball)"],
    rows: d.records.map((r) => [
      r.name,
      r.status ? (STATUS[r.status] ?? r.status) : "Belgilanmagan",
      r.checkIn ? formatTime(new Date(r.checkIn)) : "—",
      r.lateMinutes,
      r.penalty,
    ]),
  };
}
