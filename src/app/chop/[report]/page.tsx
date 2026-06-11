import { notFound } from "next/navigation";
import { formatNumber } from "@/lib/format";
import { buildReport, REPORTS, type ReportKind } from "@/lib/reports";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function ChopPage({
  params,
}: {
  params: Promise<{ report: string }>;
}) {
  const { report } = await params;
  if (!REPORTS.includes(report as ReportKind)) notFound();
  const data = await buildReport(report as ReportKind);
  const now = new Date();

  return (
    <div className="mx-auto max-w-3xl bg-white p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-lg font-semibold text-primary">💊 Dorixona</div>
          <h1 className="mt-2 text-xl font-semibold">{data.title}</h1>
          <p className="text-sm text-muted">
            Sana: {now.toLocaleDateString("uz-UZ")} {now.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <PrintButton auto />
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {data.columns.map((c) => (
              <th key={c} className="border border-edge bg-primary-light px-3 py-2 text-left font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="border border-edge px-3 py-2">
                  {typeof cell === "number" && cell >= 1000 ? formatNumber(cell) : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-8 text-xs text-muted print:hidden">
        Tip: Chop etish oynasida &quot;Saqlash PDF&quot; ni tanlang.
      </p>
    </div>
  );
}
