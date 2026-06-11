"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatTime } from "@/lib/format";
import { Badge } from "@/components/ui";
import { Field, FormError, Input, Modal, Select, SubmitButton } from "@/components/Modal";
import { markAttendance } from "@/lib/actions/attendance";

type Rec = {
  employeeId: string;
  name: string;
  checkIn: string | null;
  lateMinutes: number;
  penalty: number;
  status: string | null;
};

function statusBadge(status: string | null, late: number) {
  if (status === "ON_LEAVE") return <Badge color="blue">Ta&apos;til</Badge>;
  if (status === "ABSENT") return <Badge color="red">Kelmadi</Badge>;
  if (status === null) return <Badge color="amber">Belgilanmagan</Badge>;
  if (late > 5) return <Badge color="amber">Kechikdi</Badge>;
  return <Badge color="green">Keldi</Badge>;
}

export function AttendancePanel({ records }: { records: Rec[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<Rec | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function submit(fd: FormData) {
    if (!target) return;
    setError("");
    start(async () => {
      const res = await markAttendance({
        employeeId: target.employeeId,
        status: fd.get("status") as never,
        checkInTime: String(fd.get("checkInTime")) || undefined,
      });
      if (res.ok) {
        setTarget(null);
        router.refresh();
      } else setError(res.error);
    });
  }

  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <div className="card p-4">
      <div className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium">📅 Bugungi davomat</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-edge text-left text-[11px] uppercase text-muted">
              <th className="pb-2 pr-3 font-medium">Xodim</th>
              <th className="pb-2 pr-3 font-medium">Kelish</th>
              <th className="pb-2 pr-3 font-medium">Kechikish</th>
              <th className="pb-2 pr-3 font-medium">Penalti</th>
              <th className="pb-2 pr-3 font-medium">Holat</th>
              <th className="pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.employeeId} className="border-b border-edge last:border-0 hover:bg-surface">
                <td className="py-2.5 pr-3 font-medium">{r.name}</td>
                <td className="py-2.5 pr-3">{r.checkIn ? formatTime(r.checkIn) : "—"}</td>
                <td
                  className="py-2.5 pr-3"
                  style={{ color: r.lateMinutes > 5 ? "var(--c-danger)" : "var(--c-muted)" }}
                >
                  {r.lateMinutes > 0 ? `${r.lateMinutes} min` : "—"}
                </td>
                <td className="py-2.5 pr-3" style={{ color: r.penalty > 0 ? "var(--c-danger)" : "var(--c-muted)" }}>
                  {r.penalty > 0 ? `-${r.penalty} ball` : "—"}
                </td>
                <td className="py-2.5 pr-3">{statusBadge(r.status, r.lateMinutes)}</td>
                <td className="py-2.5 text-right">
                  <button
                    onClick={() => { setError(""); setTarget(r); }}
                    className="rounded-md border border-edge px-2 py-1 text-xs hover:bg-surface"
                  >
                    Belgilash
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!target} onClose={() => setTarget(null)} title={`Davomat: ${target?.name ?? ""}`}>
        <form action={submit} className="space-y-3">
          <Field label="Holat">
            <Select name="status" defaultValue="PRESENT">
              <option value="PRESENT">Keldi</option>
              <option value="ON_LEAVE">Ta&apos;tilda (ruxsatli)</option>
              <option value="ABSENT">Kelmadi</option>
            </Select>
          </Field>
          <Field label="Kelish vaqti (faqat 'Keldi' uchun)">
            <Input name="checkInTime" type="time" defaultValue={hhmm} />
          </Field>
          <p className="text-xs text-muted">
            Ish 09:00 da boshlanadi. Kechikish penalti avtomatik hisoblanadi (1–5 daq: ogohlantirish,
            6–15 daq: −2, 16–60 daq: −5, 60+ daq: −10).
          </p>
          <FormError message={error} />
          <SubmitButton pending={pending}>Belgilash</SubmitButton>
        </form>
      </Modal>
    </div>
  );
}
