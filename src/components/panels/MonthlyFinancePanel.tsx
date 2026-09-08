"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatSom } from "@/lib/format";
import { Card } from "@/components/ui";
import { Field, FormError, Input, Modal, SubmitButton } from "@/components/Modal";
import { autofillMonthlyFinance, saveMonthlyFinance } from "@/lib/actions/monthly-finance";

export type MonthlyUnit = {
  unit: string;
  turnover: number;
  profit: number;
  expenses: number;
  netProfit: number;
  stockValue: number;
  revaluation: number;
  bankBalance: number | null;
  note: string | null;
};

type Props = {
  /** Ko'rsatiladigan oy sarlavhasi, masalan "2026-yil avgust" */
  label: string;
  year: number;
  month: number;
  /** MonthlyFinance yozuvi bor birliklar */
  rows: MonthlyUnit[];
  /** Barcha haqiqiy dorixonalar ("Umumiy" bundan mustasno) */
  allUnits: string[];
};

const MLN = 1_000_000;

/** Formaga mln'da ko'rsatamiz: 671000000 -> "671" */
const toMln = (n: number | null) => (n === null || n === 0 ? "" : String(n / MLN));

function Row({ label, value, muted = true }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className={muted ? "text-muted" : ""}>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function MonthlyFinancePanel({ label, year, month, rows, allUnits }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<MonthlyUnit | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [pending, start] = useTransition();

  // Yozuvi yo'q dorixonalar ham ko'rinsin — aks holda ularga kiritib bo'lmaydi
  const byUnit = new Map(rows.map((r) => [r.unit, r]));
  const units: MonthlyUnit[] = allUnits.map(
    (unit) =>
      byUnit.get(unit) ?? {
        unit,
        turnover: 0,
        profit: 0,
        expenses: 0,
        netProfit: 0,
        stockValue: 0,
        revaluation: 0,
        bankBalance: null,
        note: null,
      },
  );

  const totalTurnover = units.reduce((s, u) => s + u.turnover, 0);

  function save(formData: FormData) {
    if (!editing) return;
    setError("");
    const som = (name: string) => {
      const raw = String(formData.get(name) ?? "").trim();
      if (raw === "") return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n * MLN : null;
    };
    start(async () => {
      const res = await saveMonthlyFinance({
        unit: editing.unit,
        year,
        month,
        turnover: som("turnover"),
        profit: som("profit"),
        stockValue: som("stockValue"),
        revaluation: som("revaluation"),
        bankBalance: som("bankBalance"),
        note: String(formData.get("note") ?? ""),
      });
      if (res.ok) {
        setEditing(null);
        router.refresh();
      } else setError(res.error);
    });
  }

  function autofill(unit: string) {
    setInfo("");
    start(async () => {
      const res = await autofillMonthlyFinance({ unit, year, month });
      if (!res.ok) {
        setInfo(`${unit}: ${res.error}`);
        return;
      }
      setInfo(
        res.salesCount === 0
          ? `${unit}: bu oy uchun savdo topilmadi — F-Apteka sync hali bu dorixonaga ulanmagan bo'lishi mumkin.`
          : `${unit}: ${res.salesCount} ta chek — savdo ${formatSom(res.turnover)}, foyda ${formatSom(res.profit)}`,
      );
      router.refresh();
    });
  }

  return (
    <Card title={`${label} — dorixonalar kesimi`} icon="🏪" className="mb-5">
      <div className="grid gap-4 lg:grid-cols-3">
        {units.map((u) => {
          const empty = u.turnover === 0 && u.profit === 0 && u.stockValue === 0;
          return (
            <div key={u.unit} className="rounded-lg border border-surface p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-medium">{u.unit}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => autofill(u.unit)}
                    disabled={pending}
                    title="Savdo va foydani bazadagi cheklardan hisoblab qo'yish"
                    className="rounded-lg border border-edge px-2 py-1 text-xs hover:bg-surface disabled:opacity-50"
                  >
                    ⟳
                  </button>
                  <button
                    onClick={() => setEditing(u)}
                    disabled={pending}
                    className="rounded-lg border border-edge px-2 py-1 text-xs hover:bg-surface disabled:opacity-50"
                  >
                    ✎
                  </button>
                </div>
              </div>

              {empty ? (
                <p className="py-3 text-sm text-muted">
                  Ma&apos;lumot kiritilmagan. ✎ tugmasi orqali kiriting.
                </p>
              ) : (
                <dl className="space-y-1.5 text-sm">
                  {u.turnover > 0 && <Row label="Savdo" value={formatSom(u.turnover)} />}
                  {u.profit > 0 && <Row label="Foyda" value={formatSom(u.profit)} />}
                  <Row label="Harajat" value={`−${formatSom(u.expenses)}`} />
                  {u.profit > 0 && (
                    <div className="flex justify-between border-t border-surface pt-1.5 font-medium">
                      <dt>Sof foyda</dt>
                      <dd style={{ color: u.netProfit >= 0 ? "var(--c-success)" : "var(--c-danger)" }}>
                        {formatSom(u.netProfit)}
                      </dd>
                    </div>
                  )}
                  {u.stockValue > 0 && <Row label="Qoldiq (astatka)" value={formatSom(u.stockValue)} />}
                  {u.revaluation > 0 && <Row label="Qayta baholash" value={formatSom(u.revaluation)} />}
                  {u.bankBalance !== null && <Row label="Bank" value={formatSom(u.bankBalance)} />}
                </dl>
              )}
              {u.note && <p className="mt-2 text-xs text-muted">{u.note}</p>}
            </div>
          );
        })}
      </div>

      {totalTurnover > 0 && (
        <div className="mt-4 flex justify-between border-t border-surface pt-3 text-sm font-medium">
          <span>Jami savdo</span>
          <span>{formatSom(totalTurnover)}</span>
        </div>
      )}

      {info && <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-xs">{info}</p>}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `${editing.unit} — ${label}` : ""}
      >
        {editing && (
          <form action={save} className="space-y-3">
            <p className="text-xs text-muted">
              Qiymatlar <b>mln so&apos;m</b>da kiritiladi (masalan 671 = 671 000 000 so&apos;m).
              Bo&apos;sh qoldirilgan maydon 0 sifatida saqlanadi.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Savdo (mln)">
                <Input name="turnover" type="number" step="0.1" min={0} defaultValue={toMln(editing.turnover)} placeholder="671" />
              </Field>
              <Field label="Foyda (mln)">
                <Input name="profit" type="number" step="0.1" min={0} defaultValue={toMln(editing.profit)} placeholder="71" />
              </Field>
              <Field label="Qoldiq / astatka (mln)">
                <Input name="stockValue" type="number" step="0.1" min={0} defaultValue={toMln(editing.stockValue)} placeholder="1282" />
              </Field>
              <Field label="Qayta baholash (mln)">
                <Input name="revaluation" type="number" step="0.1" min={0} defaultValue={toMln(editing.revaluation)} placeholder="34" />
              </Field>
            </div>
            <Field label="Bank qoldig'i (mln) — ixtiyoriy">
              <Input name="bankBalance" type="number" step="0.1" min={0} defaultValue={toMln(editing.bankBalance)} />
            </Field>
            <Field label="Izoh">
              <Input name="note" defaultValue={editing.note ?? ""} placeholder="Ixtiyoriy" />
            </Field>
            <FormError message={error} />
            <SubmitButton pending={pending} />
          </form>
        )}
      </Modal>
    </Card>
  );
}
