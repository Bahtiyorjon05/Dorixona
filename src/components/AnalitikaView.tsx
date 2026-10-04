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
type PaymentRow = { day: string; unit: string; method: string; amount: number };
type CheckRow = { day: string; unit: string; checks: number; net: number };
type GroupRow = { name: string; qty: number; turnover: number };
type SupplierRow = { name: string; amount: number; docs: number };
type SupplierStockRow = { name: string; stock: number; sales: number; months: number };

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
  payments: PaymentRow[];
  checks: CheckRow[];
  groups: GroupRow[];
  suppliers: SupplierRow[];
  supplierStock: SupplierStockRow[];
  hasSupplierMap: boolean;
};

/** F-Apteka "Отчеты" ro'yxati — o'zbekcha. `ready` = bizda ma'lumot bormi. */
const REPORTS = [
  { key: "assortiment", label: "Assortiment (sana holatiga)", ready: true },
  { key: "top500", label: "TOP savdo", ready: true },
  { key: "lejeboki", label: "Sekin sotiladigan (lejeboki)", ready: true },
  { key: "aylanuvchanlik", label: "Aylanuvchanlik", ready: true },
  { key: "vedomost", label: "Tovar bo'yicha aylanma vedomost", ready: true },
  { key: "tolov", label: "To'lov usullari bo'yicha", ready: true },
  { key: "cheklar", label: "Cheklar bo'yicha", ready: true },
  { key: "guruhlar", label: "Guruhlar bo'yicha savdo", ready: true },
] as const;

/** F-Apteka "Графики" ro'yxati (5 ta) + bizda ishlaydigan qo'shimchalar. */
const CHARTS = [
  { key: "dinamika", label: "Savdo va foyda dinamikasi", ready: true },
  { key: "astatka", label: "Astatka dinamikasi", ready: true },
  { key: "filiallar", label: "Dorixonalar taqqoslashi", ready: true },
  { key: "ombor", label: "Ombor qiymati (toifalar)", ready: true },
  { key: "kunlik", label: "Kunlik savdo grafigi", ready: true },
  { key: "postavshik_qoldiq", label: "Yetkazib beruvchilar — qoldiq", ready: true },
  { key: "postavshik_qoldiq_savdo", label: "Yetkazib beruvchilar — qoldiq/savdo", ready: true },
  { key: "postavshik_kirim", label: "Yetkazib beruvchilar — kirim", ready: true },
  { key: "postavshik_savdo", label: "Yetkazib beruvchilar — savdo", ready: true },
] as const;

type ReportKey = (typeof REPORTS)[number]["key"];
type ChartKey = (typeof CHARTS)[number]["key"];

function Kutilyapti({ nima }: { nima: string }) {
  return (
    <div className="flex h-[220px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-edge px-6 text-center">
      <span className="text-2xl">⏳</span>
      <p className="text-sm text-muted">
        Bu grafik <b>{nima}</b> talab qiladi — ulanmoqda.
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
  payments,
  checks,
  groups,
  suppliers,
  supplierStock,
  hasSupplierMap,
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

  // To'lov va cheklar kunlik keladi — hisobotning dan/gacha sanasi bo'yicha
  const inRange = (day: string) => day >= dan && day <= gacha;
  const payRange = payments.filter((p) => inRange(p.day));
  const units = [...new Set(payRange.map((p) => p.unit))].sort();
  const methods = [...new Set(payRange.map((p) => p.method))];
  const payTotal = payRange.reduce((s, p) => s + p.amount, 0);
  const payBy = (method: string, unit?: string) =>
    payRange.filter((p) => p.method === method && (!unit || p.unit === unit)).reduce((s, p) => s + p.amount, 0);
  const checkRange = checks.filter((c) => inRange(c.day));
  const checkTotal = checkRange.reduce((s, c) => s + c.checks, 0);
  const checkNet = checkRange.reduce((s, c) => s + c.net, 0);
  const groupTotal = groups.reduce((s, g) => s + g.turnover, 0);
  const supplierTotal = suppliers.reduce((s, x) => s + x.amount, 0);
  const supStockTotal = supplierStock.reduce((s, x) => s + x.stock, 0);
  const supSalesTotal = supplierStock.reduce((s, x) => s + x.sales, 0);
  const mln = (value: number) => (value / 1_000_000).toFixed(1);

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
        ) : report === "tolov" ? (
          methods.length === 0 ? <Bosh /> : (
            <div>
              <p className="mb-2 text-sm text-muted">
                Kassaga tushgan pul, jami {formatNumber(Math.round(payTotal))} so&apos;m
              </p>
              <DataTable
                head={["To'lov usuli", ...units, "Jami", "Ulush"]}
                rows={methods
                  .map((m) => ({ m, total: payBy(m) }))
                  .sort((a, b) => b.total - a.total)
                  .map(({ m, total }) => [
                    m,
                    ...units.map((u) => formatNumber(Math.round(payBy(m, u)))),
                    formatNumber(Math.round(total)),
                    payTotal > 0 ? `${((total / payTotal) * 100).toFixed(1)}%` : "—",
                  ])}
              />
            </div>
          )
        ) : report === "cheklar" ? (
          checkRange.length === 0 ? <Bosh /> : (
            <div>
              <p className="mb-2 text-sm text-muted">
                {formatNumber(checkTotal)} ta chek, {formatNumber(Math.round(checkNet))} so&apos;m, o&apos;rtacha chek{" "}
                {formatNumber(checkTotal > 0 ? Math.round(checkNet / checkTotal) : 0)} so&apos;m
              </p>
              <DataTable
                head={["Kun", "Dorixona", "Chek", "Savdo", "O'rtacha chek"]}
                rows={checkRange.map((c) => [
                  c.day.split("-").reverse().join("."),
                  c.unit,
                  formatNumber(c.checks),
                  formatNumber(Math.round(c.net)),
                  formatNumber(c.checks > 0 ? Math.round(c.net / c.checks) : 0),
                ])}
              />
            </div>
          )
        ) : report === "guruhlar" ? (
          groups.length === 0 ? <Bosh /> : (
            <div>
              <p className="mb-2 text-sm text-muted">{year}-yil — tovar guruhlari bo&apos;yicha savdo</p>
              <DataTable
                head={["Guruh", "Soni", "Tushum (mln)", "Ulush"]}
                rows={groups.map((g) => [
                  g.name,
                  formatNumber(g.qty),
                  (g.turnover / 1_000_000).toFixed(1),
                  groupTotal > 0 ? `${((g.turnover / groupTotal) * 100).toFixed(1)}%` : "—",
                ])}
              />
            </div>
          )
        ) : null}
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
        {chart === "postavshik_kirim" && (
          suppliers.length === 0 ? <Bosh /> : (
            <>
              <p className="mb-3 text-sm text-muted">
                {year}-yil — yetkazib beruvchilardan kirim, jami {(supplierTotal / 1_000_000).toFixed(1)} mln so&apos;m
              </p>
              <DataTable
                head={["Yetkazib beruvchi", "Hujjat", "Kirim (mln)", "Ulush"]}
                rows={suppliers.map((x) => [
                  x.name,
                  formatNumber(x.docs),
                  (x.amount / 1_000_000).toFixed(1),
                  supplierTotal > 0 ? `${((x.amount / supplierTotal) * 100).toFixed(1)}%` : "—",
                ])}
              />
            </>
          )
        )}
        {chart === "postavshik_qoldiq" && (
          !hasSupplierMap ? <Kutilyapti nima="har bir tovarning yetkazib beruvchisini (F-Apteka bazasidan)" /> : (
            <>
              <p className="mb-3 text-sm text-muted">
                Hozirgi qoldiq tan narxda, jami {mln(supStockTotal)} mln so&apos;m
              </p>
              <DataTable
                head={["Yetkazib beruvchi", "Qoldiq (mln)", "Ulush"]}
                rows={[...supplierStock]
                  .filter((x) => x.stock > 0)
                  .sort((a, b) => b.stock - a.stock)
                  .map((x) => [
                    x.name,
                    mln(x.stock),
                    supStockTotal > 0 ? `${((x.stock / supStockTotal) * 100).toFixed(1)}%` : "—",
                  ])}
              />
            </>
          )
        )}
        {chart === "postavshik_savdo" && (
          supSalesTotal === 0 ? <Kutilyapti nima="chek qatorlari bo'yicha yetkazib beruvchi savdosini (F-Apteka bazasidan)" /> : (
            <>
              <p className="mb-3 text-sm text-muted">
                {year}-yil — yetkazib beruvchilar tovari savdosi, jami {mln(supSalesTotal)} mln so&apos;m
              </p>
              <DataTable
                head={["Yetkazib beruvchi", "Savdo (mln)", "Ulush"]}
                rows={[...supplierStock]
                  .filter((x) => x.sales !== 0)
                  .sort((a, b) => b.sales - a.sales)
                  .map((x) => [
                    x.name,
                    mln(x.sales),
                    supSalesTotal > 0 ? `${((x.sales / supSalesTotal) * 100).toFixed(1)}%` : "—",
                  ])}
              />
            </>
          )
        )}
        {chart === "postavshik_qoldiq_savdo" && (
          !hasSupplierMap || supSalesTotal === 0 ? (
            <Kutilyapti nima="yetkazib beruvchi bo'yicha qoldiq va savdoni (F-Apteka bazasidan)" />
          ) : (
            <>
              <p className="mb-3 text-sm text-muted">
                Qoldiq necha oylik savdoga yetadi — raqam katta bo&apos;lsa, tovar ko&apos;p turib qolgan
              </p>
              <DataTable
                head={["Yetkazib beruvchi", "Qoldiq (mln)", "Oylik savdo (mln)", "Necha oyga yetadi"]}
                rows={[...supplierStock]
                  .filter((x) => x.stock > 0)
                  .sort((a, b) => b.stock - a.stock)
                  .map((x) => {
                    const monthly = x.months > 0 ? x.sales / x.months : 0;
                    return [x.name, mln(x.stock), mln(monthly), monthly > 0 ? (x.stock / monthly).toFixed(1) : "—"];
                  })}
              />
            </>
          )
        )}
      </Card>
    </div>
  );
}
