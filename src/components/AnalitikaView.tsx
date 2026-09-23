"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatNumber } from "@/lib/format";
import { Card } from "@/components/ui";
import {
  AstatkaChart,
  DinamikaChart,
  FiliallarChart,
  KunlikChart,
  OmborToifaChart,
} from "@/components/charts/AnalyticsCharts";

type MonthPoint = { month: number; label: string; savdo: number; foyda: number; astatka: number; xarajat: number };
type UnitPoint = { unit: string; savdo: number; foyda: number; astatka: number };
type AssortItem = { name: string; category: string; stock: number; price: number; value: number };
type TopItem = { name: string; qty: number; turnover: number; profit: number };
type SlowItem = { name: string; stock: number; qty: number; value: number };
type RatioItem = { name: string; stock: number; qty: number; ratio: number };
type VedomostItem = { name: string; incoming: number; sold: number; stock: number };
type DayPoint = { label: string; savdo: number; foyda: number };

type Props = {
  year: number;
  monthly: MonthPoint[];
  byUnit: UnitPoint[];
  lastMonthName: string | null;
  inventoryByCategory: { name: string; value: number }[];
  inventoryTotal: number;
  assortment: AssortItem[];
  topProducts: TopItem[];
  slowMovers: SlowItem[];
  turnoverRatio: RatioItem[];
  vedomost: VedomostItem[];
  dailySales: DayPoint[];
};

/** F-Apteka "Отчеты" ro'yxati — o'zbekcha. `ready` = bizda ma'lumot bormi. */
const REPORTS = [
  { key: "assortiment", label: "Assortiment (sana holatiga)", ready: true },
  { key: "top500", label: "TOP savdo", ready: true },
  { key: "lejeboki", label: "Sekin sotiladigan (lejeboki)", ready: true },
  { key: "aylanuvchanlik", label: "Aylanuvchanlik", ready: true },
  { key: "vedomost", label: "Tovar bo'yicha aylanma vedomost", ready: true },
  { key: "tolov", label: "To'lov usullari bo'yicha", ready: false },
  { key: "cheklar", label: "Cheklar bo'yicha", ready: false },
  { key: "guruhlar", label: "Guruhlar bo'yicha savdo", ready: false },
] as const;

/** F-Apteka "Графики" ro'yxati (5 ta) + bizda ishlaydigan qo'shimchalar. */
const CHARTS = [
  { key: "dinamika", label: "Savdo va foyda dinamikasi", ready: true },
  { key: "astatka", label: "Astatka dinamikasi", ready: true },
  { key: "filiallar", label: "Dorixonalar taqqoslashi", ready: true },
  { key: "ombor", label: "Ombor qiymati (toifalar)", ready: true },
  { key: "kunlik", label: "Kunlik savdo grafigi", ready: true },
  { key: "postavshik_qoldiq", label: "Yetkazib beruvchilar — qoldiq", ready: false },
  { key: "postavshik_qoldiq_savdo", label: "Yetkazib beruvchilar — qoldiq/savdo", ready: false },
  { key: "postavshik_kirim", label: "Yetkazib beruvchilar — kirim", ready: false },
  { key: "postavshik_savdo", label: "Yetkazib beruvchilar — savdo", ready: false },
] as const;

type ReportKey = (typeof REPORTS)[number]["key"];
type ChartKey = (typeof CHARTS)[number]["key"];

function Kutilyapti({ nima }: { nima: string }) {
  return (
    <div className="flex h-[220px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-edge px-6 text-center">
      <span className="text-2xl">⏳</span>
      <p className="text-sm text-muted">
        Bu hisobot <b>{nima}</b> talab qiladi. Hozirgi F-Apteka API&apos;sida bu ma&apos;lumot yo&apos;q —
        texnik bo&apos;lim qo&apos;shib bergach avtomatik to&apos;ladi.
      </p>
    </div>
  );
}

function Bosh() {
  return <p className="py-10 text-center text-sm text-muted">Bu davr uchun ma&apos;lumot yo&apos;q.</p>;
}

/** Oddiy jadval: birinchi ustun chapda, qolganlari o'ngda */
function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="-mx-2 max-h-[460px] overflow-auto">
      <table className="w-full min-w-[440px] text-sm">
        <thead>
          <tr className="border-b border-edge text-left text-xs text-muted">
            {head.map((title, i) => (
              <th key={title} className={`px-2 py-1.5 ${i === 0 ? "" : "text-right"}`}>
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-edge/50">
              {row.map((cell, j) => (
                <td key={j} className={`px-2 py-1.5 ${j === 0 ? "" : "text-right"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AnalitikaView({
  year,
  monthly,
  byUnit,
  lastMonthName,
  inventoryByCategory,
  inventoryTotal,
  assortment,
  topProducts,
  slowMovers,
  turnoverRatio,
  vedomost,
  dailySales,
}: Props) {
  const router = useRouter();
  const [report, setReport] = useState<ReportKey>("assortiment");
  const [chart, setChart] = useState<ChartKey>("dinamika");

  // dan/gacha — F-Apteka "С / По". Standart: joriy yil.
  const [dan, setDan] = useState(`${year}-01-01`);
  const [gacha, setGacha] = useState(`${year}-12-31`);
  // Grafik uchun alohida dan/gacha (F-Apteka'da har bo'limda o'z sanasi bor)
  const [gDan, setGDan] = useState(`${year}-01-01`);
  const [gGacha, setGGacha] = useState(`${year}-12-31`);

  // Grafik sanasiga ko'ra oylarni filtrlash
  const danMonth = Number(gDan.slice(5, 7)) || 1;
  const gachaMonth = Number(gGacha.slice(5, 7)) || 12;
  const monthlyRange = monthly.filter((m) => m.month >= danMonth && m.month <= gachaMonth);

  const now = new Date().getFullYear();
  const years = [now + 1, now, now - 1, now - 2];

  const selectClass =
    "rounded-lg border border-edge bg-transparent px-3 py-2 text-sm outline-none focus:border-primary";
  const dateClass =
    "rounded-lg border border-edge bg-transparent px-2.5 py-2 text-sm outline-none focus:border-primary";

  const activeReport = REPORTS.find((r) => r.key === report)!;
  const activeChart = CHARTS.find((c) => c.key === chart)!;
  const assortTotal = assortment.reduce((s, a) => s + a.value, 0);

  return (
    <div className="space-y-4">
      {/* ─── Hisobotlar (F-Apteka "Отчеты") ─── */}
      <Card title="Hisobotlar" icon="📋">
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Hisobot
            <select
              value={report}
              onChange={(e) => setReport(e.target.value as ReportKey)}
              className={`${selectClass} min-w-[240px]`}
            >
              {REPORTS.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                  {r.ready ? "" : " — (kutilyapti)"}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            dan
            <input type="date" value={dan} onChange={(e) => setDan(e.target.value)} className={dateClass} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            gacha
            <input type="date" value={gacha} onChange={(e) => setGacha(e.target.value)} className={dateClass} />
          </label>
        </div>

        {activeReport.key === "assortiment" ? (
          assortment.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Omborda qoldiq yo&apos;q.</p>
          ) : (
            <div>
              <p className="mb-2 text-sm text-muted">
                Hozirgi qoldiq — eng qimmat {assortment.length} pozitsiya, jami{" "}
                {formatNumber(assortTotal)} mln so&apos;m (chakana narxda)
              </p>
              <div className="-mx-2 overflow-x-auto">
                <table className="w-full min-w-[440px] text-sm">
                  <thead>
                    <tr className="border-b border-edge text-left text-xs text-muted">
                      <th className="px-2 py-1.5">Nomi</th>
                      <th className="px-2 py-1.5">Toifa</th>
                      <th className="px-2 py-1.5 text-right">Qoldiq</th>
                      <th className="px-2 py-1.5 text-right">Narx</th>
                      <th className="px-2 py-1.5 text-right">Qiymat (mln)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assortment.map((a, i) => (
                      <tr key={i} className="border-b border-edge/50">
                        <td className="px-2 py-1.5">{a.name}</td>
                        <td className="px-2 py-1.5 text-muted">{a.category}</td>
                        <td className="px-2 py-1.5 text-right">{formatNumber(a.stock)}</td>
                        <td className="px-2 py-1.5 text-right">{formatNumber(a.price)}</td>
                        <td className="px-2 py-1.5 text-right">{a.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : report === "top500" ? (
          topProducts.length === 0 ? <Bosh /> : (
            <div>
              <p className="mb-2 text-sm text-muted">
                {year}-yilda eng ko&apos;p tushum keltirgan {topProducts.length} tovar
              </p>
              <DataTable
                head={["Nomi", "Soni", "Tushum (mln)", "Foyda (mln)"]}
                rows={topProducts.map((item) => [item.name, formatNumber(item.qty), item.turnover, item.profit])}
              />
            </div>
          )
        ) : report === "lejeboki" ? (
          slowMovers.length === 0 ? <Bosh /> : (
            <div>
              <p className="mb-2 text-sm text-muted">
                Qoldig&apos;i bor, lekin {year}-yilda kam sotilgan tovarlar — pul shu yerda qotib turadi
              </p>
              <DataTable
                head={["Nomi", "Qoldiq", "Sotilgan", "Qiymat (mln)"]}
                rows={slowMovers.map((item) => [item.name, formatNumber(item.stock), formatNumber(item.qty), item.value])}
              />
            </div>
          )
        ) : report === "aylanuvchanlik" ? (
          turnoverRatio.length === 0 ? <Bosh /> : (
            <div>
              <p className="mb-2 text-sm text-muted">
                Yillik savdo qoldiqqa nisbatan necha marta aylangan — raqam katta bo&apos;lsa, tovar tez ketadi
              </p>
              <DataTable
                head={["Nomi", "Qoldiq", "Sotilgan", "Aylanish"]}
                rows={turnoverRatio.map((item) => [
                  item.name,
                  formatNumber(item.stock),
                  formatNumber(item.qty),
                  `${item.ratio}x`,
                ])}
              />
            </div>
          )
        ) : report === "vedomost" ? (
          vedomost.length === 0 ? <Bosh /> : (
            <div>
              <p className="mb-2 text-sm text-muted">
                {year}-yil: kirim, sotuv va hozirgi qoldiq
              </p>
              <DataTable
                head={["Nomi", "Kirim", "Sotilgan", "Qoldiq"]}
                rows={vedomost.map((item) => [
                  item.name,
                  formatNumber(item.incoming),
                  formatNumber(item.sold),
                  formatNumber(item.stock),
                ])}
              />
            </div>
          )
        ) : (
          <Kutilyapti
            nima={
              report === "guruhlar"
                ? "F-Apteka tovar guruhlari ma'lumotini"
                : "F-Apteka chek ma'lumotini (14-hisobot)"
            }
          />
        )}
      </Card>

      {/* ─── Grafiklar (F-Apteka "Графики") ─── */}
      <Card title="Grafiklar" icon="📈">
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Grafik
            <select
              value={chart}
              onChange={(e) => setChart(e.target.value as ChartKey)}
              className={`${selectClass} min-w-[240px]`}
            >
              {CHARTS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                  {c.ready ? "" : " — (kutilyapti)"}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Yil
            <select
              value={year}
              onChange={(e) => router.push(`/analitika?yil=${e.target.value}`)}
              className={selectClass}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            dan
            <input type="date" value={gDan} onChange={(e) => setGDan(e.target.value)} className={dateClass} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            gacha
            <input type="date" value={gGacha} onChange={(e) => setGGacha(e.target.value)} className={dateClass} />
          </label>
        </div>

        {chart === "dinamika" && (
          <>
            <p className="mb-3 text-sm text-muted">{year}-yil oylik ko&apos;rsatkichlar (mln so&apos;m)</p>
            <DinamikaChart data={monthlyRange} />
          </>
        )}
        {chart === "astatka" && <AstatkaChart data={monthlyRange} />}
        {chart === "filiallar" && (
          <>
            <p className="mb-3 text-sm text-muted">
              {lastMonthName ? `${lastMonthName} oyi` : "Oxirgi oy"} — dorixonalar kesimi (mln so&apos;m)
            </p>
            <FiliallarChart data={byUnit} />
          </>
        )}
        {chart === "ombor" && (
          <>
            <p className="mb-3 text-sm text-muted">
              Hozirgi qoldiq chakana narxda, jami {formatNumber(inventoryTotal)} mln so&apos;m
            </p>
            <OmborToifaChart data={inventoryByCategory} />
          </>
        )}
        {chart === "kunlik" && (
          dailySales.length === 0 ? <Bosh /> : (
            <>
              <p className="mb-3 text-sm text-muted">Oxirgi 60 kun — kunlik savdo va foyda (mln so&apos;m)</p>
              <KunlikChart data={dailySales} />
            </>
          )
        )}
        {!activeChart.ready && <Kutilyapti nima="F-Apteka yetkazib beruvchi ma'lumotini" />}
      </Card>
    </div>
  );
}
