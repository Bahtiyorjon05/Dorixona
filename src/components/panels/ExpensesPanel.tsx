"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDate, formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui";
import { Field, FormError, Input, Modal, PrimaryButton, Select, SubmitButton } from "@/components/Modal";
import { createExpense, deleteExpense } from "@/lib/actions/expenses";

type Expense = {
  id: string;
  title: string;
  category: string;
  amount: number;
  spentAt: string | Date;
  isRecurring: boolean;
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

export function ExpensesPanel({ list }: { list: Expense[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState("ALL");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const filtered = useMemo(
    () => (filter === "ALL" ? list : list.filter((e) => e.category === filter)),
    [list, filter],
  );

  function add(formData: FormData) {
    setError("");
    start(async () => {
      const res = await createExpense({
        title: String(formData.get("title")),
        category: formData.get("category") as never,
        amount: Number(formData.get("amount")),
        spentAt: String(formData.get("spentAt")) || undefined,
        isRecurring: formData.get("isRecurring") === "on",
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else setError(res.error);
    });
  }

  function remove(id: string) {
    if (!confirm("Ushbu harajatni o'chirasizmi?")) return;
    start(async () => {
      await deleteExpense(id);
      router.refresh();
    });
  }

  return (
    <div className="card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium">🧾 Harajatlar ro'yxati</span>
        <div className="flex items-center gap-2">
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="!w-auto !py-1.5 text-xs">
            <option value="ALL">Barchasi</option>
            {CATS.map((c) => (
              <option key={c} value={c}>
                {CATEGORY[c].label}
              </option>
            ))}
          </Select>
          <PrimaryButton onClick={() => setOpen(true)}>+ Qo'shish</PrimaryButton>
        </div>
      </div>

      <div className="flex flex-col">
        {filtered.length === 0 && <p className="py-6 text-center text-sm text-muted">Harajat yo'q</p>}
        {filtered.map((e) => {
          const cat = CATEGORY[e.category] ?? CATEGORY.OTHER;
          return (
            <div key={e.id} className="group flex items-center gap-3 border-b border-edge py-3 last:border-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface text-base">
                {cat.icon}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{e.title}</div>
                <div className="text-xs text-muted">{formatDate(e.spentAt)}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">{formatNumber(e.amount)}</div>
                <Badge color={cat.color}>{e.isRecurring ? "Doimiy" : cat.label}</Badge>
              </div>
              <button
                onClick={() => remove(e.id)}
                className="ml-1 text-muted opacity-0 transition hover:text-danger group-hover:opacity-100"
                title="O'chirish"
              >
                🗑
              </button>
            </div>
          );
        })}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Yangi harajat">
        <form action={add} className="space-y-3">
          <Field label="Nomi">
            <Input name="title" required placeholder="Masalan: Ijara to'lovi" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kategoriya">
              <Select name="category" required defaultValue="OTHER">
                {CATS.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY[c].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Summa (so'm)">
              <Input name="amount" type="number" min={1} required placeholder="1000000" />
            </Field>
          </div>
          <Field label="Sana">
            <Input name="spentAt" type="date" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isRecurring" /> Doimiy xarajat
          </label>
          <FormError message={error} />
          <SubmitButton pending={pending} />
        </form>
      </Modal>
    </div>
  );
}
