"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatNumber } from "@/lib/format";
import { TIERS } from "@/lib/loyalty";
import { Badge } from "@/components/ui";
import { Field, FormError, Input, Modal, PrimaryButton, SubmitButton } from "@/components/Modal";
import { adjustPoints, createCustomer } from "@/lib/actions/customers";

type Txn = { id: string; type: string; points: number; note: string | null; createdAt: string };
type Customer = {
  id: string;
  fullName: string | null;
  phone: string;
  cardCode: string;
  points: number;
  tier: "BRONZE" | "SILVER" | "GOLD";
  totalSpent: number;
  viaTelegram: boolean;
  history: Txn[];
};

const TIER_BADGE: Record<string, "green" | "amber" | "blue"> = {
  BRONZE: "blue",
  SILVER: "amber",
  GOLD: "green",
};
const TXN_LABEL: Record<string, string> = {
  EARN: "Xariddan",
  REDEEM: "Ishlatildi",
  SIGNUP_BONUS: "Ro'yxat bonusi",
  ADJUST: "Tuzatish",
};

export function CustomersPanel({ customers }: { customers: Customer[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [adjust, setAdjust] = useState<Customer | null>(null);
  const [history, setHistory] = useState<Customer | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        (c.fullName ?? "").toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.cardCode.toLowerCase().includes(q),
    );
  }, [customers, query]);

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
        <span className="flex items-center gap-2 text-sm font-medium">🪪 Mijozlar ro'yxati</span>
        <div className="flex items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ism, telefon yoki karta..."
            className="!w-56 !py-1.5 text-xs"
          />
          <PrimaryButton onClick={() => { setError(""); setAddOpen(true); }}>+ Mijoz qo'shish</PrimaryButton>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-edge text-left text-[11px] uppercase text-muted">
              <th className="pb-2 pr-3 font-medium">Mijoz</th>
              <th className="pb-2 pr-3 font-medium">Karta</th>
              <th className="pb-2 pr-3 font-medium">Ballar</th>
              <th className="pb-2 pr-3 font-medium">Daraja</th>
              <th className="pb-2 pr-3 font-medium">Jami xarid</th>
              <th className="pb-2 pr-3 font-medium">Manba</th>
              <th className="pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-edge last:border-0 hover:bg-surface">
                <td className="py-2.5 pr-3">
                  <div className="font-medium">{c.fullName ?? "—"}</div>
                  <div className="text-xs text-muted">{c.phone}</div>
                </td>
                <td className="py-2.5 pr-3 text-muted">{c.cardCode}</td>
                <td className="py-2.5 pr-3 font-medium text-primary">{c.points}</td>
                <td className="py-2.5 pr-3">
                  <Badge color={TIER_BADGE[c.tier]}>
                    {TIERS[c.tier].emoji} {TIERS[c.tier].label}
                  </Badge>
                </td>
                <td className="py-2.5 pr-3">{formatNumber(c.totalSpent)}</td>
                <td className="py-2.5 pr-3 text-muted">{c.viaTelegram ? "📲 Telegram" : "✍️ Qo'lda"}</td>
                <td className="py-2.5 text-right whitespace-nowrap">
                  <button
                    onClick={() => { setError(""); setAdjust(c); }}
                    className="rounded-md border border-edge px-2 py-1 text-xs hover:bg-surface"
                    title="Ball tuzatish"
                  >
                    ± ball
                  </button>
                  <button
                    onClick={() => setHistory(c)}
                    className="ml-1 rounded-md border border-edge px-2 py-1 text-xs hover:bg-surface"
                    title="Tarix"
                  >
                    🕘
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-muted">
                  Mijoz topilmadi
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mijoz qo'shish */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Yangi mijoz">
        <form
          action={(fd) =>
            run(
              () =>
                createCustomer({
                  fullName: String(fd.get("fullName")),
                  phone: String(fd.get("phone")),
                  birthday: String(fd.get("birthday")) || undefined,
                }),
              () => setAddOpen(false),
            )
          }
          className="space-y-3"
        >
          <Field label="To'liq ism">
            <Input name="fullName" required placeholder="Ism Familiya" />
          </Field>
          <Field label="Telefon raqami">
            <Input name="phone" required placeholder="+998901112233" />
          </Field>
          <Field label="Tug'ilgan kun (ixtiyoriy)">
            <Input name="birthday" type="date" />
          </Field>
          <FormError message={error} />
          <SubmitButton pending={pending} />
        </form>
      </Modal>

      {/* Ball tuzatish */}
      <Modal open={!!adjust} onClose={() => setAdjust(null)} title={`Ball tuzatish: ${adjust?.fullName ?? ""}`}>
        {adjust && (
          <form
            action={(fd) =>
              run(
                () =>
                  adjustPoints({
                    customerId: adjust.id,
                    points: Number(fd.get("points")),
                    note: String(fd.get("note")) || undefined,
                  }),
                () => setAdjust(null),
              )
            }
            className="space-y-3"
          >
            <p className="text-sm text-muted">Joriy balans: {adjust.points} ball</p>
            <Field label="O'zgartirish (musbat qo'shadi, manfiy ayiradi)">
              <Input name="points" type="number" required placeholder="masalan: 50 yoki -20" autoFocus />
            </Field>
            <Field label="Izoh">
              <Input name="note" placeholder="Sabab" />
            </Field>
            <FormError message={error} />
            <SubmitButton pending={pending} />
          </form>
        )}
      </Modal>

      {/* Tarix */}
      <Modal open={!!history} onClose={() => setHistory(null)} title={`Tarix: ${history?.fullName ?? ""}`}>
        {history && (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {history.history.length === 0 && (
              <p className="py-4 text-center text-sm text-muted">Hali harakatlar yo'q</p>
            )}
            {history.history.map((t) => (
              <div key={t.id} className="flex items-center justify-between border-b border-edge pb-2 text-sm">
                <div>
                  <div className="font-medium">{TXN_LABEL[t.type] ?? t.type}</div>
                  <div className="text-xs text-muted">
                    {new Date(t.createdAt).toLocaleDateString("uz-UZ")} · {t.note ?? ""}
                  </div>
                </div>
                <div className={`font-semibold ${t.points >= 0 ? "text-primary" : "text-danger"}`}>
                  {t.points >= 0 ? "+" : ""}
                  {t.points}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
