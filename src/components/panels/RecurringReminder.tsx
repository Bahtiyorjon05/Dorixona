"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatSom } from "@/lib/format";
import { copyRecurringExpense } from "@/lib/actions/expenses";

type Missing = {
  id: string;
  title: string;
  category: string;
  amount: number;
  unit: string | null;
};

/**
 * Doimiy xarajat shu oyda kiritilmagan bo'lsa eslatadi va bir bosishda
 * nusxalaydi. Avvalgi "hammasini ko'chirish" tugmasi takror yozuvlar
 * yaratgani uchun bu yerda har biri alohida tasdiqlanadi.
 */
export function RecurringReminder({ items, month }: { items: Missing[]; month: string }) {
  const router = useRouter();
  const [done, setDone] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const left = items.filter((item) => !done.includes(item.id));
  if (left.length === 0) return null;

  function copy(item: Missing) {
    setError("");
    start(async () => {
      const result = await copyRecurringExpense(item.id);
      if (!result.ok) {
        setError(result.error ?? "Xatolik");
        return;
      }
      setDone((list) => [...list, item.id]);
      router.refresh();
    });
  }

  return (
    <div className="mb-5 rounded-lg border border-edge bg-accent-light p-3 text-sm">
      <div className="mb-2">
        <b>Doimiy xarajatlar {month} oyida hali kiritilmagan:</b>
      </div>
      <div className="flex flex-wrap gap-2">
        {left.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={pending}
            onClick={() => copy(item)}
            className="rounded-lg border border-edge bg-card px-3 py-1.5 text-xs transition hover:border-primary disabled:opacity-60"
            title="Bosilsa shu oyga nusxalanadi, summani keyin tahrirlaysiz"
          >
            + {item.title} · {formatSom(item.amount)}
            {item.unit ? ` · ${item.unit}` : ""}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      <p className="mt-2 text-xs text-muted">
        Bosilgan xarajat o&apos;tgan oydagi summa bilan qo&apos;shiladi — summasi o&apos;zgargan bo&apos;lsa,
        ro&apos;yxatdan tahrirlang.
      </p>
    </div>
  );
}
