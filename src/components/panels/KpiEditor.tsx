"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bonusPercentForScore, computeTotalScore } from "@/lib/kpi";
import { formatNumber } from "@/lib/format";
import { Field, FormError, Input, Modal, SubmitButton } from "@/components/Modal";
import { saveKpi } from "@/lib/actions/kpi";

type Components = {
  sales: number;
  margin: number;
  attendance: number;
  discipline: number;
  customer: number;
};

const FIELDS: { key: keyof Components; label: string }[] = [
  { key: "sales", label: "Savdo (40%)" },
  { key: "margin", label: "Marja (20%)" },
  { key: "attendance", label: "Davomat (15%)" },
  { key: "discipline", label: "Intizom (10%)" },
  { key: "customer", label: "Mijoz (15%)" },
];

export function KpiEditor({
  employeeId,
  name,
  baseSalary,
  current,
}: {
  employeeId: string;
  name: string;
  baseSalary: number;
  current: Components;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Components>(current);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const total = computeTotalScore({
    salesScore: vals.sales,
    marginScore: vals.margin,
    attendanceScore: vals.attendance,
    disciplineScore: vals.discipline,
    customerScore: vals.customer,
  });
  const bonusPercent = bonusPercentForScore(total);
  const bonusAmount = Math.round((baseSalary * bonusPercent) / 100);

  function save() {
    setError("");
    start(async () => {
      const res = await saveKpi({
        employeeId,
        salesScore: vals.sales,
        marginScore: vals.margin,
        attendanceScore: vals.attendance,
        disciplineScore: vals.discipline,
        customerScore: vals.customer,
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <>
      <button
        onClick={() => { setVals(current); setError(""); setOpen(true); }}
        className="rounded-md border border-edge px-2 py-1 text-xs hover:bg-surface"
        title="KPI tahrirlash"
      >
        ✏️
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={`KPI: ${name}`}>
        <div className="space-y-3">
          {FIELDS.map((f) => (
            <Field key={f.key} label={f.label}>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={vals[f.key]}
                  onChange={(e) => setVals((v) => ({ ...v, [f.key]: Number(e.target.value) }))}
                  className="flex-1 accent-[var(--c-primary)]"
                />
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={vals[f.key]}
                  onChange={(e) =>
                    setVals((v) => ({ ...v, [f.key]: Math.max(0, Math.min(100, Number(e.target.value))) }))
                  }
                  className="!w-16 text-center"
                />
              </div>
            </Field>
          ))}

          <div className="rounded-xl border border-edge bg-gradient-to-br from-primary-light to-info-light p-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-xl font-semibold text-primary">{total}</div>
                <div className="text-[11px] text-muted">Yakuniy ball</div>
              </div>
              <div>
                <div className="text-xl font-semibold text-primary">{bonusPercent}%</div>
                <div className="text-[11px] text-muted">Bonus foiz</div>
              </div>
              <div>
                <div className="text-xl font-semibold text-primary">{formatNumber(bonusAmount)}</div>
                <div className="text-[11px] text-muted">Bonus (so'm)</div>
              </div>
            </div>
          </div>

          <FormError message={error} />
          <button
            onClick={save}
            disabled={pending}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>
      </Modal>
    </>
  );
}
