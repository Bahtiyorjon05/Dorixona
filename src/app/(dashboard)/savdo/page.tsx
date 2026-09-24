import { Card, MetricCard, PageHeader } from "@/components/ui";
import { formatDate, formatNumber, formatSom } from "@/lib/format";
import { getSalesData } from "@/lib/queries";

export const dynamic = "force-dynamic";

const inputClass =
  "rounded-lg border border-edge bg-card px-3 py-2 text-sm text-fg outline-none focus:border-primary";

function parseDay(raw: string | string[] | undefined) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toInputValue(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function margin(turnover: number, profit: number) {
  return turnover > 0 ? `${((profit / turnover) * 100).toFixed(1)}%` : "—";
}

export default async function SavdoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const today = new Date();
  // Standart: joriy oy boshidan bugungacha
  const from = parseDay(params.dan) ?? new Date(today.getFullYear(), today.getMonth(), 1);
  const to = parseDay(params.gacha) ?? today;
  const d = await getSalesData({ from, to });

  const days = d.daily.length;
  const average = days > 0 ? d.turnover / days : 0;

  return (
    <div>
      <PageHeader
        title="Savdo"
        subtitle={`F-Apteka kassasidan kelgan sotuvlar — ${d.filial}`}
      />

      <form method="get" className="mb-5 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          dan
          <input type="date" name="dan" defaultValue={toInputValue(from)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          gacha
          <input type="date" name="gacha" defaultValue={toInputValue(to)} className={inputClass} />
        </label>
        <button type="submit" className="btn btn-primary">
          Ko&apos;rsatish
        </button>
      </form>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard icon="🧾" label="Tushum" value={formatSom(d.turnover)} />
        <MetricCard
          icon="📈"
          label="Foyda"
          value={formatSom(d.profit)}
          sub={`Marja ${margin(d.turnover, d.profit)}`}
          valueColor="var(--c-primary)"
        />
        <MetricCard icon="📅" label="Kunlik o'rtacha" value={formatSom(average)} sub={`${days} kun`} />
        {d.hasPayments ? (
          <MetricCard
            icon="💳"
            label="Naqd / Karta"
            value={formatSom(d.cashTotal)}
            sub={`Karta: ${formatSom(d.cardTotal)}`}
          />
        ) : d.hasRefunds ? (
          <MetricCard
            icon="↩️"
            label="Qaytarilgan tovar"
            value={formatSom(d.refundTotal)}
            valueColor={d.refundTotal > 0 ? "var(--c-danger)" : undefined}
            sub="Tushumdan ayrilgan"
          />
        ) : (
          <MetricCard
            icon="💊"
            label="Sotilgan tovar turi"
            value={`${formatNumber(d.products.length)}+`}
            sub="Eng ko'plari pastda"
          />
        )}
      </div>

      {d.costMissing && (
        <div className="mb-5 rounded-lg border border-edge bg-accent-light p-3 text-sm">
          Foyda tushumga teng chiqyapti — demak tovarlarning tan narxi hali to&apos;lmagan.
          Tan narx F-Apteka kirim hujjatlaridan keladi. Ular tushgach, foyda o&apos;zi to&apos;g&apos;rilanadi.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Kunlik savdo" icon="📅">
          {d.daily.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Bu oraliqda savdo yo&apos;q.</p>
          ) : (
            <div className="max-h-[420px] overflow-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Sana</th>
                    <th>Tushum</th>
                    {d.hasPayments && <th>Naqd</th>}
                    {d.hasPayments && <th>Karta</th>}
                    {d.hasRefunds && <th>Qaytarish</th>}
                    <th>Foyda</th>
                    <th>Marja</th>
                  </tr>
                </thead>
                <tbody>
                  {d.daily.map((row) => (
                    <tr key={row.day.toISOString()}>
                      <td className="whitespace-nowrap">{formatDate(row.day)}</td>
                      <td>{formatSom(row.turnover)}</td>
                      {d.hasPayments && <td>{formatSom(row.cash)}</td>}
                      {d.hasPayments && <td>{formatSom(row.card)}</td>}
                      {d.hasRefunds && (
                        <td className={row.refund > 0 ? "text-danger" : undefined}>
                          {row.refund > 0 ? formatSom(row.refund) : "—"}
                        </td>
                      )}
                      <td>{formatSom(row.profit)}</td>
                      <td>{margin(row.turnover, row.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Dorixonalar bo'yicha" icon="🏪">
            {d.byUnit.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">Ma&apos;lumot yo&apos;q.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Dorixona</th>
                    <th>Tushum</th>
                    <th>Foyda</th>
                    <th>Marja</th>
                  </tr>
                </thead>
                <tbody>
                  {d.byUnit.map((row) => (
                    <tr key={row.unit}>
                      <td>{row.unit}</td>
                      <td>{formatSom(row.turnover)}</td>
                      <td>{formatSom(row.profit)}</td>
                      <td>{margin(row.turnover, row.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Eng ko'p sotilgan tovarlar" icon="🔝">
            {d.products.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">Ma&apos;lumot yo&apos;q.</p>
            ) : (
              <div className="max-h-[420px] overflow-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tovar</th>
                      <th>Soni</th>
                      <th>Tushum</th>
                      <th>Foyda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.products.map((row) => (
                      <tr key={row.name}>
                        <td className="max-w-[220px] truncate" title={row.name}>{row.name}</td>
                        <td>{formatNumber(Math.round(row.quantity))}</td>
                        <td>{formatSom(row.turnover)}</td>
                        <td>{formatSom(row.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted">
        F-Apteka kunlik jamlanma beradi, chekma-chek emas — shuning uchun chek soni ko&apos;rsatilmaydi.
        Ma&apos;lumot har 15 daqiqada yangilanadi.
      </p>
    </div>
  );
}
