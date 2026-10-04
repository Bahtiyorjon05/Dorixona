"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createEmployee } from "@/lib/actions/employees";

type Missing = { cashier: string; unit: string; shifts: number; lastDay: string };

/** "DILBAR" -> "Dilbar" */
const titleCase = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

/**
 * F-Apteka'da smena ochgan, lekin Xodimlar ro'yxatida yo'q kassirlar.
 * Qo'shilgach KPI va davomatga ism bo'yicha avtomatik bog'lanadi.
 */
export function MissingCashiers({ items }: { items: Missing[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [done, setDone] = useState<string[]>([]);

  if (!items.length) return null;

  function add(item: Missing) {
    setError("");
    start(async () => {
      const res = await createEmployee({
        fullName: titleCase(item.cashier),
        position: "Kassir",
        baseSalary: 0,
        unit: item.unit,
      });
      if (res.ok) {
        setDone((list) => [...list, `${item.unit}|${item.cashier}`]);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <div className="card mb-5 p-4">
      <div className="mb-3 text-sm font-medium">🧑‍💼 Xodimlar ro&apos;yxatida yo&apos;q kassirlar (F-Apteka)</div>
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}
      <div className="space-y-2">
        {items.map((item) => {
          const key = `${item.unit}|${item.cashier}`;
          return (
            <div key={key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-edge px-3 py-2 text-sm">
              <span>
                <b>{item.cashier}</b> <span className="text-muted">· {item.unit} · {item.shifts} smena, oxirgisi {item.lastDay}</span>
              </span>
              {done.includes(key) ? (
                <span className="text-xs text-primary">Qo&apos;shildi</span>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => add(item)}
                  className="rounded-lg border border-edge px-3 py-1 text-xs hover:bg-surface disabled:opacity-50"
                >
                  Xodim qilib qo&apos;shish
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
