import { getAttendanceData, getFinanceData, getKpiData } from "@/lib/queries";
import { monthName } from "@/lib/format";

export type ReportData = {
  filename: string;
  sheet: string;
  title: string;
  columns: string[];
  rows: (string | number)[][];
};

export const REPORTS = ["kpi", "finance", "attendance"] as const;
export type ReportKind = (typeof REPORTS)[number];

export async function buildReport(kind: ReportKind): Promise<ReportData> {
  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

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
      r.checkIn ? new Date(r.checkIn).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }) : "—",
      r.lateMinutes,
      r.penalty,
    ]),
  };
}
