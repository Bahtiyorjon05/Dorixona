import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/auth";
import { buildReport, REPORTS, type ReportKind } from "@/lib/reports";

export const runtime = "nodejs";

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ report: string }> },
) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const { report } = await params;
  if (!REPORTS.includes(report as ReportKind)) {
    return new Response("Noma'lum hisobot", { status: 404 });
  }

  const format = req.nextUrl.searchParams.get("format") ?? "csv";
  const data = await buildReport(report as ReportKind);

  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(data.sheet);
    const header = ws.addRow(data.columns);
    header.font = { bold: true };
    header.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5F0" } };
    });
    data.rows.forEach((r) => ws.addRow(r));
    ws.columns.forEach((col) => {
      let max = 10;
      col.eachCell?.({ includeEmpty: true }, (cell) => {
        max = Math.max(max, String(cell.value ?? "").length + 2);
      });
      col.width = max;
    });
    const buffer = await wb.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${data.filename}.xlsx"`,
      },
    });
  }

  // CSV (default) — UTF-8 BOM Excel uchun
  const lines = [data.columns, ...data.rows].map((r) => r.map(csvCell).join(","));
  const csv = "﻿" + lines.join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${data.filename}.csv"`,
    },
  });
}
