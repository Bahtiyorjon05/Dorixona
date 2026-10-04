"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatTime } from "@/lib/format";
import { Badge } from "@/components/ui";
import { Field, FormError, Input, Modal, Select, SubmitButton } from "@/components/Modal";
import { markAttendance } from "@/lib/actions/attendance";
import { SearchBox, matchesSearch } from "@/components/SearchBox";

type Rec = {
  employeeId: string;
  name: string;
  checkIn: string | null;
  lateMinutes: number;
  penalty: number;
  status: string | null;
};

/** F-Apteka smenasi (birinchi va oxirgi chek) */
export type ShiftInfo = { opened: string; closed: string; active: boolean; checks: number };

function statusBadge(status: string | null, late: number, shift?: ShiftInfo) {
  if (status === "ON_LEAVE") return <Badge color="blue">Ta&apos;til</Badge>;
  if (status === "ABSENT") return <Badge color="red">Kelmadi</Badge>;
  // Qo'lda belgilanmagan, lekin kassada smenasi bor
  if (status === null && shift) {
    return shift.active ? <Badge color="green">Smenada</Badge> : <Badge color="blue">Smena tugadi</Badge>;
  }
  if (status === null) return <Badge color="amber">Belgilanmagan</Badge>;
  if (late > 5) return <Badge color="amber">Kechikdi</Badge>;
  return <Badge color="green">Keldi</Badge>;
}

export function AttendancePanel({
  records,
  shifts = {},
  unmatched = [],
  date,
  title = "Bugungi davomat",
}: {
  records: Rec[];
  shifts?: Record<string, ShiftInfo>;
  unmatched?: { cashier: string; unit: string }[];
  /** Ko'rilayotgan kun ("YYYY-MM-DD") — belgilash shu kunga yoziladi */
  date?: string;
  title?: string;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<Rec | null>(null);
  const [query, setQuery] = useState("");
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
        date,
      });
      if (res.ok) {
        setTarget(null);
        router.refresh();
      } else setError(res.error);
    });
  }

  // Xodim ismi bo'yicha qidiriladi
  const shown = useMemo(() => records.filter((r) => matchesSearch(query, r.name)), [records, query]);

  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <div className="card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium">📅 {title}</span>
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Xodim ismi..."
          className="w-full sm:w-56"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-edge text-left text-[11px] uppercase text-muted">
              <th className="pb-2 pr-3 font-medium">Xodim</th>
              <th className="pb-2 pr-3 font-medium">Kelish</th>
              <th className="pb-2 pr-3 font-medium">Kassa yopish</th>
              <th className="pb-2 pr-3 font-medium">Kechikish</th>
              <th className="pb-2 pr-3 font-medium">Penalti</th>
              <th className="pb-2 pr-3 font-medium">Holat</th>
              <th className="pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.employeeId} className="border-b border-edge last:border-0 hover:bg-surface">
                <td className="py-2.5 pr-3 font-medium">{r.name}</td>
                {/* Kelish: kassada smena ochilgani (birinchi chek), bo'lmasa qo'lda kiritilgani */}
                <td className="py-2.5 pr-3" title={shifts[r.employeeId] ? `${shifts[r.employeeId].checks} ta chek` : undefined}>
                  {shifts[r.employeeId]
                    ? formatTime(shifts[r.employeeId].opened)
                    : r.checkIn
                      ? formatTime(r.checkIn)
                      : "—"}
                </td>
                <td className="py-2.5 pr-3">
                  {shifts[r.employeeId]
                    ? shifts[r.employeeId].active
                      ? <span className="text-primary">ochiq</span>
                      : formatTime(shifts[r.employeeId].closed)
                    : "—"}
                </td>
                <td
                  className="py-2.5 pr-3"
                  style={{ color: r.lateMinutes > 5 ? "var(--c-danger)" : "var(--c-muted)" }}
                >
                  {r.lateMinutes > 0 ? `${r.lateMinutes} min` : "—"}
                </td>
                <td className="py-2.5 pr-3" style={{ color: r.penalty > 0 ? "var(--c-danger)" : "var(--c-muted)" }}>
                  {r.penalty > 0 ? `-${r.penalty} ball` : "—"}
                </td>
                <td className="py-2.5 pr-3">{statusBadge(r.status, r.lateMinutes, shifts[r.employeeId])}</td>
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
      {unmatched.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          Xodimga bog&apos;lanmagan kassir: {unmatched.map((u) => `${u.cashier} (${u.unit})`).join(", ")}
        </p>
      )}

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
