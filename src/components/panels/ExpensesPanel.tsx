"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDate, formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui";
import { Field, FormError, Input, Modal, PrimaryButton, Select, SubmitButton } from "@/components/Modal";
import { createExpense, deleteExpense, updateExpense } from "@/lib/actions/expenses";

type Expense = {
  id: string;
  title: string;
  category: string;
  amount: number;
  spentAt: string | Date;
  isRecurring: boolean;
  unit?: string | null;
};

const CATEGORY: Record<string, { label: string; icon: string; color: "green" | "amber" | "red" | "blue" }> = {
  RENT: { label: "Ijara", icon: "🏠", color: "amber" },
  UTILITIES: { label: "Kommunal", icon: "⚡", color: "blue" },
  GOODS: { label: "Tovar", icon: "🚚", color: "amber" },
  SALARY: { label: "Xodimlar", icon: "👥", color: "red" },
  LICENSE: { label: "Rasmiy", icon: "📜", color: "green" },
  OTHER: { label: "Boshqa", icon: "📌", color: "blue" },
};
const CATS = Object.keys(CATEGORY);
const UMUMIY = "Umumiy";

function toDateInput(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function ExpensesPanel({ list, units = [] }: { list: Expense[]; units?: string[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState("ALL");
  const [unitFilter, setUnitFilter] = useState("ALL");
  const [editing, setEditing] = useState<Expense | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirming, setConfirming] = useState<Expense | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const unitOptions = useMemo(() => {
    const found = new Set<string>(units);
    for (const e of list) if (e.unit) found.add(e.unit);
    return Array.from(found).sort();
  }, [list, units]);

  const filtered = useMemo(
    () =>
      list.filter(
        (e) =>
          (filter === "ALL" || e.category === filter) &&
          (unitFilter === "ALL" || (e.unit ?? UMUMIY) === unitFilter),
      ),
    [list, filter, unitFilter],
  );

  const shown = useMemo(() => filtered.reduce((s, e) => s + e.amount, 0), [filtered]);

  function openCreate() {
    setEditing(null);
    setError("");
    setFormOpen(true);
  }

  function openEdit(expense: Expense) {
    setEditing(expense);
    setError("");
    setFormOpen(true);
  }

  function save(formData: FormData) {
    setError("");
    const payload = {
      title: String(formData.get("title")),
      category: formData.get("category") as never,
      amount: Number(formData.get("amount")),
      spentAt: String(formData.get("spentAt")) || undefined,
      isRecurring: formData.get("isRecurring") === "on",
      unit: String(formData.get("unit") ?? UMUMIY),
    };
    start(async () => {
      const res = editing ? await updateExpense(editing.id, payload) : await createExpense(payload);
      if (res.ok) {
        setFormOpen(false);
        setEditing(null);
        router.refresh();
      } else setError(res.error);
    });
  }

  function confirmDelete() {
    const target = confirming;
    if (!target) return;
    setError("");
    start(async () => {
      const res = await deleteExpense(target.id);
      if (res.ok) {
        setConfirming(null);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <div className="card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium">
          🧾 Harajatlar ro&apos;yxati
          <span className="text-xs font-normal text-muted">
            {filtered.length} ta · {formatNumber(shown)} so&apos;m
          </span>
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {unitOptions.length > 0 && (
            <Select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="!w-auto !py-1.5 text-xs"
            >
              <option value="ALL">Barcha dorixona</option>
              {unitOptions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
              <option value={UMUMIY}>{UMUMIY}</option>
            </Select>
          )}
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="!w-auto !py-1.5 text-xs">
            <option value="ALL">Barchasi</option>
            {CATS.map((c) => (
              <option key={c} value={c}>
                {CATEGORY[c].label}
              </option>
            ))}
          </Select>
          <PrimaryButton onClick={openCreate}>+ Qo&apos;shish</PrimaryButton>
        </div>
      </div>

      <div className="flex flex-col">
        {filtered.length === 0 && <p className="py-6 text-center text-sm text-muted">Harajat yo&apos;q</p>}
        {filtered.map((e) => {
          const cat = CATEGORY[e.category] ?? CATEGORY.OTHER;
          return (
            <div key={e.id} className="group flex items-center gap-3 border-b border-edge py-3 last:border-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface text-base">
                {cat.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{e.title}</div>
                <div className="text-xs text-muted">
                  {formatDate(e.spentAt)}
                  {e.unit ? ` · ${e.unit}` : ` · ${UMUMIY}`}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">{formatNumber(e.amount)}</div>
                <Badge color={cat.color}>{e.isRecurring ? "Doimiy" : cat.label}</Badge>
              </div>
              <div className="ml-1 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                <button
                  onClick={() => openEdit(e)}
                  className="rounded p-1 text-muted transition hover:text-primary"
                  title="Tahrirlash"
                >
                  ✏️
                </button>
                <button
                  onClick={() => setConfirming(e)}
                  className="rounded p-1 text-muted transition hover:text-danger"
                  title="O'chirish"
                >
                  🗑
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        title={editing ? "Harajatni tahrirlash" : "Yangi harajat"}
      >
        <form action={save} className="space-y-3">
          <Field label="Nomi">
            <Input name="title" required defaultValue={editing?.title ?? ""} placeholder="Masalan: Ijara" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kategoriya">
              <Select name="category" required defaultValue={editing?.category ?? "OTHER"}>
                {CATS.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY[c].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Summa">
              <Input
                name="amount"
                type="number"
                min={1}
                required
                defaultValue={editing?.amount ?? ""}
                placeholder="1000000"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dorixona">
              <Select name="unit" defaultValue={editing?.unit ?? UMUMIY}>
                <option value={UMUMIY}>{UMUMIY}</option>
                {unitOptions.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Sana">
              <Input name="spentAt" type="date" defaultValue={editing ? toDateInput(editing.spentAt) : ""} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isRecurring" defaultChecked={editing?.isRecurring ?? false} /> Doimiy
            xarajat
          </label>
          <FormError message={error} />
          <SubmitButton pending={pending} />
        </form>
      </Modal>

      <Modal open={!!confirming} onClose={() => setConfirming(null)} title="Harajatni o'chirish">
        <div className="space-y-4">
          <p className="text-sm">
            <span className="font-medium">{confirming?.title}</span> —{" "}
            {confirming ? formatNumber(confirming.amount) : ""} so&apos;m o&apos;chirilsinmi?
          </p>
          <p className="text-xs text-muted">Bu amalni ortga qaytarib bo&apos;lmaydi.</p>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className="rounded-lg border border-edge px-3 py-2 text-sm transition hover:bg-surface"
            >
              Bekor qilish
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={pending}
              className="rounded-lg bg-danger px-3 py-2 text-sm font-medium text-white transition disabled:opacity-60"
            >
              {pending ? "O'chirilmoqda…" : "O'chirish"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
