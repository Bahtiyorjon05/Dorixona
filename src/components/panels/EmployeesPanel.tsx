"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui";
import { Field, FormError, Input, Modal, PrimaryButton, Select, SubmitButton } from "@/components/Modal";
import { createEmployee, updateEmployee } from "@/lib/actions/employees";

type Employee = {
  id: string;
  fullName: string;
  position: string;
  branch: string;
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
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

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
      <div className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium">👥 Xodimlar</span>
        <PrimaryButton onClick={() => { setError(""); setAddOpen(true); }}>+ Yangi xodim</PrimaryButton>
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
            {employees.map((e, i) => {
              const st = STATUS[e.status] ?? STATUS.ACTIVE;
              const initials = e.fullName.split(" ").map((w) => w[0]).slice(0, 2).join("");
              return (
                <tr key={e.id} className="border-b border-edge last:border-0 hover:bg-surface">
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
                  <td className="py-2.5 pr-3 text-muted">{e.branch}</td>
                  <td className="py-2.5 pr-3">{formatNumber(e.baseSalary)}</td>
                  <td className="py-2.5 pr-3">
                    <Badge color={st.color}>{st.label}</Badge>
                  </td>
                  <td className="py-2.5 pr-3 font-medium" style={{ color: kpiColor(e.kpi) }}>
                    {e.kpi != null ? `${e.kpi}%` : "—"}
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => { setError(""); setEdit(e); }}
                      className="rounded-md border border-edge px-2 py-1 text-xs hover:bg-surface"
                    >
                      ✏️
                    </button>
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
          <Field label="Base maosh (so'm)">
            <Input name="baseSalary" type="number" min={0} required placeholder="4000000" />
          </Field>
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
                  <option value="ON_LEAVE">Ta'tilda</option>
                  <option value="INACTIVE">Faol emas</option>
                </Select>
              </Field>
            </div>
            <Field label="Base maosh (so'm)">
              <Input name="baseSalary" type="number" min={0} required defaultValue={edit.baseSalary} />
            </Field>
            <FormError message={error} />
            <SubmitButton pending={pending} />
          </form>
        )}
      </Modal>
    </div>
  );
}
