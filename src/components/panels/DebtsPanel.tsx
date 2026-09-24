"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";
import { Field, FormError, Input, Modal, PrimaryButton, Select, SubmitButton } from "@/components/Modal";
import { formatDate, formatNumber } from "@/lib/format";
import { addDebtEntry, createDebt, deleteDebt, updateDebtDueDate } from "@/lib/actions/debts";

type Entry = {
  id: string;
  type: "CHARGE" | "PAYMENT";
  amount: number;
  happenedAt: string | Date;
  note?: string | null;
};

export type DebtRow = {
  id: string;
  counterparty: string;
  kind: "FIRM" | "STREET";
  currency: "UZS" | "USD";
  total: number;
  paid: number;
  remaining: number;
  dueDate: string | Date | null;
  closed: boolean;
  overdue: boolean;
  dueSoon: boolean;
  unit?: string | null;
  note?: string | null;
  entries: Entry[];
};

const KIND_LABEL: Record<string, string> = {
  FIRM: "Firmadan qarz",
  STREET: "Ko'chadan qarz",
};

function money(amount: number, currency: "UZS" | "USD") {
  return currency === "USD" ? `$${formatNumber(Math.round(amount))}` : `${formatNumber(amount)} so'm`;
}

function toDateInput(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function daysLeft(due: string | Date) {
  const date = typeof due === "string" ? new Date(due) : due;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / 864e5);
}

/** Muddat ustuni: o'tgani qizil, yaqinlashgani sariq */
function DueCell({ debt }: { debt: DebtRow }) {
  if (!debt.dueDate) return <span className="text-muted">—</span>;
  const left = daysLeft(debt.dueDate);
  const text = formatDate(debt.dueDate);

  if (debt.closed) return <span className="text-muted">{text}</span>;
  if (debt.overdue) {
    return (
      <span className="font-semibold text-danger">
        {text} · {Math.abs(left)} kun o&apos;tdi
      </span>
    );
  }
  if (debt.dueSoon) {
    return (
      <span className="font-medium" style={{ color: "var(--c-accent)" }}>
        {text} · {left} kun qoldi
      </span>
    );
  }
  return (
    <span>
      {text} <span className="text-muted">· {left} kun</span>
    </span>
  );
}

export function DebtsPanel({ debts, units = [] }: { debts: DebtRow[]; units?: string[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<"ALL" | "FIRM" | "STREET">("ALL");
  const [showClosed, setShowClosed] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [entryFor, setEntryFor] = useState<{ debt: DebtRow; type: "CHARGE" | "PAYMENT" } | null>(null);
  const [historyFor, setHistoryFor] = useState<DebtRow | null>(null);
  const [confirming, setConfirming] = useState<DebtRow | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const shown = useMemo(
    () => debts.filter((debt) => (kind === "ALL" || debt.kind === kind) && (showClosed || !debt.closed)),
    [debts, kind, showClosed],
  );

  function run(action: () => Promise<{ ok: boolean; error?: string }>, onDone?: () => void) {
    setError("");
    start(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Xatolik");
        return;
      }
      onDone?.();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="ALL">Hammasi</option>
          <option value="FIRM">Firmadan qarz</option>
          <option value="STREET">Ko&apos;chadan qarz</option>
        </Select>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
          Yopilganlar ham
        </label>
        <div className="ml-auto">
          <PrimaryButton onClick={() => { setError(""); setCreateOpen(true); }}>+ Yangi qarz</PrimaryButton>
        </div>
      </div>

      <FormError message={error} />

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Kim</th>
              <th>Turi</th>
              <th>Olingan</th>
              <th>To&apos;langan</th>
              <th>Qoldiq</th>
              <th>Muddat</th>
              <th>Amal</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-muted">
                  Qarz yo&apos;q.
                </td>
              </tr>
            )}
            {shown.map((debt) => (
              <tr key={debt.id} className={debt.overdue ? "bg-danger-light" : undefined}>
                <td className="text-left">
                  <div className="font-medium">{debt.counterparty}</div>
                  {debt.note && <div className="text-xs text-muted">{debt.note}</div>}
                </td>
                <td>
                  <span className="text-xs text-muted">{KIND_LABEL[debt.kind]}</span>
                </td>
                <td className="whitespace-nowrap">{money(debt.total, debt.currency)}</td>
                <td className="whitespace-nowrap">{money(debt.paid, debt.currency)}</td>
                <td className="whitespace-nowrap font-semibold">
                  {debt.closed ? <Badge color="green">Yopilgan</Badge> : money(debt.remaining, debt.currency)}
                </td>
                <td className="whitespace-nowrap">
                  <DueCell debt={debt} />
                </td>
                <td className="whitespace-nowrap">
                  <div className="flex flex-wrap justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => { setError(""); setEntryFor({ debt, type: "PAYMENT" }); }}
                      className="rounded-lg bg-primary px-2 py-1 text-xs font-medium text-white"
                    >
                      To&apos;lov
                    </button>
                    <button
                      type="button"
                      onClick={() => { setError(""); setEntryFor({ debt, type: "CHARGE" }); }}
                      className="rounded-lg border border-edge px-2 py-1 text-xs"
                    >
                      + Qarz
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryFor(debt)}
                      className="rounded-lg border border-edge px-2 py-1 text-xs"
                    >
                      Tarix
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(debt)}
                      className="rounded-lg border border-edge px-2 py-1 text-xs text-danger"
                    >
                      O&apos;chirish
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Yangi qarz */}
      <Modal open={createOpen} title="Yangi qarz" onClose={() => setCreateOpen(false)}>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const fd = new FormData(event.currentTarget);
            run(
              () =>
                createDebt({
                  counterparty: String(fd.get("counterparty") ?? ""),
                  kind: String(fd.get("kind") ?? "FIRM") as "FIRM" | "STREET",
                  currency: String(fd.get("currency") ?? "UZS") as "UZS" | "USD",
                  amount: Number(fd.get("amount") ?? 0),
                  dueDate: String(fd.get("dueDate") ?? "") || undefined,
                  unit: String(fd.get("unit") ?? "") || undefined,
                  note: String(fd.get("note") ?? "") || undefined,
                }),
              () => setCreateOpen(false),
            );
          }}
        >
          <Field label="Kimdan / kimga">
            <Input name="counterparty" required placeholder="OOO FARM SAVDO yoki Akmal aka" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Turi">
              <Select name="kind" defaultValue="FIRM">
                <option value="FIRM">Firmadan qarz (tovar)</option>
                <option value="STREET">Ko&apos;chadan qarz (naqd)</option>
              </Select>
            </Field>
            <Field label="Valyuta">
              <Select name="currency" defaultValue="UZS">
                <option value="UZS">so&apos;m</option>
                <option value="USD">dollar</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Summa">
              <Input name="amount" type="number" min="1" step="0.01" required />
            </Field>
            <Field label="To'lash muddati">
              <Input name="dueDate" type="date" />
            </Field>
          </div>
          <Field label="Dorixona">
            <Select name="unit" defaultValue="Umumiy">
              <option value="Umumiy">Umumiy</option>
              {units.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Izoh">
            <Input name="note" placeholder="Nima uchun olindi" />
          </Field>
          <SubmitButton pending={pending}>Saqlash</SubmitButton>
        </form>
      </Modal>

      {/* To'lov yoki yangi qarz qo'shish */}
      <Modal
        open={entryFor !== null}
        title={
          entryFor?.type === "PAYMENT"
            ? `To'lov — ${entryFor?.debt.counterparty}`
            : `Yangi qarz — ${entryFor?.debt.counterparty}`
        }
        onClose={() => setEntryFor(null)}
      >
        {entryFor && (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const fd = new FormData(event.currentTarget);
              run(
                () =>
                  addDebtEntry({
                    debtId: entryFor.debt.id,
                    type: entryFor.type,
                    amount: Number(fd.get("amount") ?? 0),
                    happenedAt: String(fd.get("happenedAt") ?? "") || undefined,
                    note: String(fd.get("note") ?? "") || undefined,
                  }),
                () => setEntryFor(null),
              );
            }}
          >
            <p className="text-sm text-muted">
              Hozirgi qoldiq: <b>{money(entryFor.debt.remaining, entryFor.debt.currency)}</b>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Summa">
                <Input name="amount" type="number" min="0.01" step="0.01" required autoFocus />
              </Field>
              <Field label="Sana">
                <Input name="happenedAt" type="date" defaultValue={toDateInput(new Date())} />
              </Field>
            </div>
            <Field label="Izoh">
              <Input name="note" placeholder={entryFor.type === "PAYMENT" ? "Naqd berildi" : "Tovar olindi"} />
            </Field>
            <SubmitButton pending={pending}>Saqlash</SubmitButton>
          </form>
        )}
      </Modal>

      {/* Tarix */}
      <Modal
        open={historyFor !== null}
        title={`Tarix — ${historyFor?.counterparty ?? ""}`}
        onClose={() => setHistoryFor(null)}
      >
        {historyFor && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <Field label="To'lash muddati">
                <Input
                  type="date"
                  defaultValue={historyFor.dueDate ? toDateInput(historyFor.dueDate) : ""}
                  onChange={(event) =>
                    run(() => updateDebtDueDate(historyFor.id, event.target.value || undefined))
                  }
                />
              </Field>
              <span className="pb-2 text-xs text-muted">O&apos;zgartirilsa darhol saqlanadi</span>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Sana</th>
                  <th>Harakat</th>
                  <th>Summa</th>
                </tr>
              </thead>
              <tbody>
                {historyFor.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="text-left whitespace-nowrap">{formatDate(entry.happenedAt)}</td>
                    <td>
                      {entry.type === "PAYMENT" ? (
                        <Badge color="green">To&apos;lov</Badge>
                      ) : (
                        <Badge color="amber">Qarz</Badge>
                      )}
                      {entry.note && <div className="text-xs text-muted">{entry.note}</div>}
                    </td>
                    <td className="whitespace-nowrap">{money(entry.amount, historyFor.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="rounded-lg bg-surface p-3 text-sm">
              Olingan {money(historyFor.total, historyFor.currency)} · To&apos;langan{" "}
              {money(historyFor.paid, historyFor.currency)} ·{" "}
              <b>Qoldiq {money(historyFor.remaining, historyFor.currency)}</b>
            </div>
          </div>
        )}
      </Modal>

      {/* O'chirish tasdiqi */}
      <Modal open={confirming !== null} title="Qarzni o'chirish" onClose={() => setConfirming(null)}>
        {confirming && (
          <div className="space-y-3">
            <p className="text-sm">
              <b>{confirming.counterparty}</b> qarzi butun tarixi bilan o&apos;chadi. Buni qaytarib
              bo&apos;lmaydi.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => deleteDebt(confirming.id), () => setConfirming(null))}
                className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white"
              >
                O&apos;chirish
              </button>
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="rounded-lg border border-edge px-4 py-2 text-sm"
              >
                Bekor qilish
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
