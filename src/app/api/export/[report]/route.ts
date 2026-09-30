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
  // ?oy=2026-9 — harajatlar hisoboti uchun tanlangan oy
  const monthMatch = /^(\d{4})-(\d{1,2})$/.exec(req.nextUrl.searchParams.get("oy") ?? "");
  const month = monthMatch ? new Date(Number(monthMatch[1]), Number(monthMatch[2]) - 1, 1) : undefined;
  const data = await buildReport(report as ReportKind, { month });

  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(data.sheet);
    const header = ws.addRow(data.columns);
    header.font = { bold: true };
    header.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5F0" } };
    });
    data.rows.forEach((r) => {
      const row = ws.addRow(r);
      if (report !== "harajatlar") return;
      // Summalar minglik ajratgich bilan, jami qatorlari qalin
      row.eachCell((cell) => {
        if (typeof cell.value === "number") cell.numFmt = "#,##0";
      });
      if (r.some((value) => typeof value === "string" && value.startsWith("JAMI"))) row.font = { bold: true };
    });
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
