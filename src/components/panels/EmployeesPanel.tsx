"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui";
import { Field, FormError, Input, Modal, PrimaryButton, Select, SubmitButton } from "@/components/Modal";
import { createEmployee, deleteEmployee, updateEmployee } from "@/lib/actions/employees";

type Employee = {
  id: string;
  fullName: string;
  position: string;
  branch: string;
  unit?: string | null;
  baseSalary: number;
  status: string;
  kpi: number | null;
};

const STATUS: Record<string, { label: string; color: "green" | "amber" | "red" }> = {
  ACTIVE: { label: "Aktiv", color: "green" },
  ON_LEAVE: { label: "Ta'tilda", color: "amber" },
  INACTIVE: { label: "Faol emas", color: "red" },
};
const AVATAR_COLORS = ["#1a7f5a", "#378add", "#f59e0b", "#e24b4a", "#7f77dd"];
const UNITS = ["Umumiy", "Yunusobod", "Qoraqamish"];

function kpiColor(kpi: number | null) {
  if (kpi == null) return "var(--c-muted)";
  if (kpi >= 90) return "var(--c-primary)";
  if (kpi >= 80) return "var(--c-accent)";
  return "var(--c-danger)";
}

export function EmployeesPanel({ employees }: { employees: Employee[] }) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [edit, setEdit] = useState<Employee | null>(null);
  const [confirming, setConfirming] = useState<Employee | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const payroll = employees.reduce((sum, e) => sum + e.baseSalary, 0);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, onOk: () => void) {
    setError("");
    start(async () => {
      const res = await action();
      if (res.ok) {
        onOk();
        router.refresh();
      } else setError(res.error || "Xatolik");
    });
  }

  return (
    <div className="card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium">
          👥 Xodimlar
          <span className="text-xs font-normal text-muted">
            {employees.length} ta · {formatNumber(payroll)} so&apos;m
          </span>
        </span>
        <PrimaryButton
          onClick={() => {
            setError("");
            setAddOpen(true);
          }}
        >
          + Yangi xodim
        </PrimaryButton>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-edge text-left text-[11px] uppercase text-muted">
              <th className="pb-2 pr-3 font-medium">Xodim</th>
              <th className="pb-2 pr-3 font-medium">Lavozim</th>
              <th className="pb-2 pr-3 font-medium">Filial</th>
              <th className="pb-2 pr-3 font-medium">Maosh</th>
              <th className="pb-2 pr-3 font-medium">Status</th>
              <th className="pb-2 pr-3 font-medium">KPI</th>
              <th className="pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-muted">
                  Bu filialda xodim yo&apos;q.
                </td>
              </tr>
            )}
            {employees.map((e, i) => {
              const st = STATUS[e.status] ?? STATUS.ACTIVE;
              const initials = e.fullName.split(" ").map((w) => w[0]).slice(0, 2).join("");
              return (
                <tr key={e.id} className="group border-b border-edge last:border-0 hover:bg-surface">
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-medium text-white"
                        style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                      >
                        {initials}
                      </div>
                      <span className="font-medium">{e.fullName}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-muted">{e.position}</td>
                  <td className="py-2.5 pr-3 text-muted">{e.unit ?? "Umumiy"}</td>
                  <td className="py-2.5 pr-3">{formatNumber(e.baseSalary)}</td>
                  <td className="py-2.5 pr-3">
                    <Badge color={st.color}>{st.label}</Badge>
                  </td>
                  <td className="py-2.5 pr-3 font-medium" style={{ color: kpiColor(e.kpi) }}>
                    {e.kpi != null ? `${e.kpi}%` : "—"}
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => {
                          setError("");
                          setEdit(e);
                        }}
                        className="rounded-md border border-edge px-2 py-1 text-xs hover:bg-surface"
                        title="Tahrirlash"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => {
                          setError("");
                          setConfirming(e);
                        }}
                        className="rounded-md border border-edge px-2 py-1 text-xs hover:bg-surface hover:text-danger"
                        title="O'chirish"
                      >
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Yangi xodim">
        <form
          action={(fd) =>
            run(
              () =>
                createEmployee({
                  fullName: String(fd.get("fullName")),
                  position: String(fd.get("position")),
                  phone: String(fd.get("phone")) || undefined,
                  baseSalary: Number(fd.get("baseSalary")),
                  unit: String(fd.get("unit") ?? "Umumiy"),
                }),
              () => setAddOpen(false),
            )
          }
          className="space-y-3"
        >
          <Field label="To'liq ism">
            <Input name="fullName" required placeholder="Ism Familiya" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Lavozim">
              <Input name="position" required placeholder="Farmatsevt" />
            </Field>
            <Field label="Telefon">
              <Input name="phone" placeholder="+998..." />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Filial">
              <Select name="unit" defaultValue="Umumiy">
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Base maosh (so'm)">
              <Input name="baseSalary" type="number" min={0} required placeholder="4000000" />
            </Field>
          </div>
          <FormError message={error} />
          <SubmitButton pending={pending} />
        </form>
      </Modal>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={`Tahrirlash: ${edit?.fullName ?? ""}`}>
        {edit && (
          <form
            action={(fd) =>
              run(
                () =>
                  updateEmployee({
                    id: edit.id,
                    fullName: String(fd.get("fullName")),
                    position: String(fd.get("position")),
                    baseSalary: Number(fd.get("baseSalary")),
                    status: fd.get("status") as never,
                    unit: String(fd.get("unit") ?? "Umumiy"),
                  }),
                () => setEdit(null),
              )
            }
            className="space-y-3"
          >
            <Field label="To'liq ism">
              <Input name="fullName" required defaultValue={edit.fullName} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Lavozim">
                <Input name="position" required defaultValue={edit.position} />
              </Field>
              <Field label="Status">
                <Select name="status" defaultValue={edit.status}>
                  <option value="ACTIVE">Aktiv</option>
                  <option value="ON_LEAVE">Ta&apos;tilda</option>
                  <option value="INACTIVE">Faol emas</option>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Filial">
                <Select name="unit" defaultValue={edit.unit ?? "Umumiy"}>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Base maosh (so'm)">
                <Input name="baseSalary" type="number" min={0} required defaultValue={edit.baseSalary} />
              </Field>
            </div>
            <FormError message={error} />
            <SubmitButton pending={pending} />
          </form>
        )}
      </Modal>

      <Modal open={!!confirming} onClose={() => setConfirming(null)} title="Xodimni o'chirish">
        <div className="space-y-4">
          <p className="text-sm">
            <span className="font-medium">{confirming?.fullName}</span> ro&apos;yxatdan o&apos;chirilsinmi?
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
              onClick={() =>
                confirming && run(() => deleteEmployee(confirming.id), () => setConfirming(null))
              }
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
