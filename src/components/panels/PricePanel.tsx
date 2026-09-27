"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";
import { Field, FormError, Input, Modal, SubmitButton } from "@/components/Modal";
import { formatDate, formatNumber, formatTime } from "@/lib/format";
import {
  addPriceWatch,
  refreshPricesNow,
  savePriceSetting,
  setPriceWatchPercent,
  setPriceWatchUrl,
  togglePriceWatch,
} from "@/lib/actions/prices";

type Item = {
  id: string;
  name: string;
  sourceUrl: string | null;
  sourceTitle: string | null;
  competitor: number | null;
  checkedAt: string | Date | null;
  our: number | null;
  cost: number | null;
  stock: number | null;
  productName: string | null;
  percent: number;
  ownPercent: number | null;
  suggested: number | null;
  diff: number | null;
  diffPercent: number | null;
  active: boolean;
  /** Oxirgi 90 kunda sotilgan dona; ombor bilan bog'lanmagan bo'lsa null */
  sold: number | null;
  perMonth: number | null;
  group: PriceGroup;
};

type PriceGroup = "top" | "slow" | "unmatched";

type Setting = { unit: string; enabled: boolean; percent: number };

type Filter = "all" | "over" | "under" | "missing";
type Group = PriceGroup | "all";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Hammasi" },
  { key: "over", label: "Qimmat turibdi" },
  { key: "under", label: "Arzon turibdi" },
  { key: "missing", label: "Narx yo'q" },
];

/** Savdo bo'yicha ikki jadval: ustama kam sotilayotganlarga kerak */
const GROUPS: { key: Group; label: string; hint: string }[] = [
  { key: "slow", label: "Kam sotilayotgan", hint: "Ustama shu ro'yxatga qo'llanadi" },
  { key: "top", label: "Topiviy dorilar", hint: "Ko'p sotilayotganlar — kuzatib turiladi" },
  { key: "unmatched", label: "Bog'lanmagan", hint: "Ombordan topilmadi, savdosi ko'rinmaydi" },
  { key: "all", label: "Hammasi", hint: "" },
];

function money(value: number | null) {
  return value === null ? "—" : formatNumber(value);
}

/** Bitta doriga alohida ustama; bo'sh qoldirilsa dorixona foizi ishlatiladi */
function PercentCell({ item, fallback }: { item: Item; fallback: number }) {
  const router = useRouter();
  const [value, setValue] = useState(item.ownPercent === null ? "" : String(item.ownPercent));
  const [pending, start] = useTransition();

  function save(next: string) {
    const trimmed = next.trim();
    const percent = trimmed === "" ? null : Number(trimmed);
    if (percent !== null && !Number.isFinite(percent)) return;
    if (percent === item.ownPercent) return;
    start(async () => {
      await setPriceWatchPercent(item.id, percent);
      router.refresh();
    });
  }

  return (
    <input
      value={value}
      disabled={pending}
      onChange={(event) => setValue(event.target.value)}
      onBlur={(event) => save(event.target.value)}
      placeholder={String(fallback)}
      title="Bo'sh qoldirilsa dorixona ustamasi qo'llanadi"
      className="w-14 rounded-lg border border-edge bg-card px-2 py-1 text-right text-sm outline-none focus:border-primary disabled:opacity-50"
    />
  );
}

/** Ustama sozlamasi — har dorixona uchun alohida yoqiladi */
function SettingRow({ setting }: { setting: Setting }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(setting.enabled);
  const [percent, setPercent] = useState(String(setting.percent));
  const [pending, start] = useTransition();

  function save(nextEnabled: boolean, nextPercent: string) {
    const value = Number(nextPercent);
    if (!Number.isFinite(value)) return;
    start(async () => {
      await savePriceSetting({ unit: setting.unit, enabled: nextEnabled, percent: value });
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-edge bg-surface px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-sm font-medium">{setting.unit}</div>
        <div className="text-xs text-muted">{enabled ? "Ustama qo'llanadi" : "O'chirilgan"}</div>
      </div>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-muted">
          <input
            type="number"
            min={0}
            max={100}
            step="0.5"
            value={percent}
            disabled={pending || !enabled}
            onChange={(event) => setPercent(event.target.value)}
            onBlur={(event) => save(enabled, event.target.value)}
            className="w-16 rounded-lg border border-edge bg-card px-2 py-1 text-right text-sm outline-none focus:border-primary disabled:opacity-50"
          />
          %
        </label>

        {/* Yoqish/o'chirish kalitchasi */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={`${setting.unit} ustamasi`}
          disabled={pending}
          onClick={() => {
            const next = !enabled;
            setEnabled(next);
            save(next, percent);
          }}
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${
            enabled ? "bg-primary" : "bg-edge"
          } disabled:opacity-60`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
              enabled ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

export function PricePanel({
  items,
  settings,
  percent,
  salesDays,
  topPerMonth,
}: {
  items: Item[];
  settings: Setting[];
  percent: number;
  salesDays: number;
  topPerMonth: number;
}) {
  const router = useRouter();
  const [group, setGroup] = useState<Group>("slow");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [linking, setLinking] = useState<Item | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const counts = useMemo(
    () => ({
      slow: items.filter((item) => item.group === "slow").length,
      top: items.filter((item) => item.group === "top").length,
      unmatched: items.filter((item) => item.group === "unmatched").length,
      all: items.length,
    }),
    [items],
  );

  const shown = useMemo(() => {
    const text = search.trim().toLowerCase();
    return items
      .filter((item) => {
        if (group !== "all" && item.group !== group) return false;
        if (text && !item.name.toLowerCase().includes(text)) return false;
        if (filter === "over") return (item.diff ?? 0) > 0;
        if (filter === "under") return item.diff !== null && item.diff < 0;
        if (filter === "missing") return item.competitor === null || item.our === null;
        return true;
      })
      .sort((a, b) => {
        // Topiviy jadvalda eng ko'p sotilgani yuqorida, qolganida eng qimmati
        if (group === "top") return (b.perMonth ?? 0) - (a.perMonth ?? 0);
        return (b.diff ?? -Infinity) - (a.diff ?? -Infinity);
      });
  }, [items, group, filter, search]);

  const activeGroup = GROUPS.find((option) => option.key === group);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, done?: () => void) {
    setError("");
    start(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Xatolik");
        return;
      }
      done?.();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {settings.map((setting) => (
          <SettingRow key={setting.unit} setting={setting} />
        ))}
      </div>

      {/* Savdo bo'yicha ikki jadval: kam sotilayotgan va topiviy */}
      <div className="rounded-lg border border-edge bg-surface p-1">
        <div className="flex flex-wrap gap-1">
          {GROUPS.map((option) => {
            const count = counts[option.key];
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setGroup(option.key)}
                className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition ${
                  group === option.key
                    ? "bg-card text-fg shadow-sm"
                    : "text-muted hover:text-fg"
                }`}
              >
                {option.label}
                <span className="ml-1.5 text-muted">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeGroup?.hint && (
        <p className="-mt-2 text-xs text-muted">
          {activeGroup.hint}
          {group !== "unmatched" &&
            ` · oxirgi ${salesDays} kun savdosi bo'yicha; oyiga ${topPerMonth} donadan ko'p sotilsa topiviy.`}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setFilter(option.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                filter === option.key
                  ? "bg-primary-light text-primary"
                  : "border border-edge text-muted hover:text-fg"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Dori nomi"
          className="min-w-[160px] flex-1 rounded-lg border border-edge bg-card px-3 py-1.5 text-sm outline-none focus:border-primary sm:max-w-[240px]"
        />

        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => setAddOpen(true)} className="btn btn-ghost btn-sm">
            + Dori
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => refreshPricesNow())}
            className="btn btn-primary btn-sm"
          >
            {pending ? "Yangilanmoqda…" : "Narxlarni yangilash"}
          </button>
        </div>
      </div>

      <FormError message={error} />

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Dori</th>
              <th>Sotilgan</th>
              <th>Bizda</th>
              <th>Raqobatchi</th>
              <th>Ustama %</th>
              <th>Tavsiya</th>
              <th>Farq</th>
              <th>Tekshirilgan</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={9} className="py-6 text-center text-muted">
                  Hech narsa topilmadi.
                </td>
              </tr>
            )}

            {shown.map((item) => {
              const over = (item.diff ?? 0) > 0;
              const under = item.diff !== null && item.diff < 0;
              return (
                <tr key={item.id} className={item.active ? undefined : "opacity-50"}>
                  <td className="text-left">
                    <div className="font-medium">{item.name}</div>
                    {item.productName && (
                      <div className="max-w-[260px] truncate text-xs text-muted" title={item.productName}>
                        {item.productName}
                        {item.stock !== null && ` · ${item.stock} dona`}
                      </div>
                    )}
                    {!item.productName && (
                      <div className="text-xs text-muted">Omborda topilmadi</div>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-xs">
                    {item.perMonth === null ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <>
                        <span className={item.group === "top" ? "font-semibold text-primary" : undefined}>
                          {item.perMonth}
                        </span>
                        <span className="text-muted"> dona/oy</span>
                      </>
                    )}
                  </td>
                  <td className="whitespace-nowrap">{money(item.our)}</td>
                  <td className="whitespace-nowrap">
                    {item.sourceUrl ? (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {money(item.competitor)}
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setError(""); setLinking(item); }}
                        className="text-xs text-muted underline"
                      >
                        havola qo&apos;shish
                      </button>
                    )}
                  </td>
                  <td className="whitespace-nowrap">
                    <PercentCell item={item} fallback={percent} />
                  </td>
                  <td className="whitespace-nowrap font-semibold">{money(item.suggested)}</td>
                  <td className="whitespace-nowrap">
                    {item.diff === null ? (
                      "—"
                    ) : over ? (
                      <span className="text-danger">
                        +{formatNumber(item.diff)}
                        {item.diffPercent !== null && (
                          <span className="ml-1 text-xs">({item.diffPercent.toFixed(1)}%)</span>
                        )}
                      </span>
                    ) : under ? (
                      <span style={{ color: "var(--c-primary)" }}>{formatNumber(item.diff)}</span>
                    ) : (
                      <Badge color="green">mos</Badge>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-xs text-muted">
                    {item.checkedAt
                      ? `${formatDate(item.checkedAt)} ${formatTime(item.checkedAt)}`
                      : "hali yo'q"}
                  </td>
                  <td className="whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => run(() => togglePriceWatch(item.id, !item.active))}
                      className="btn btn-ghost btn-sm"
                      title={item.active ? "Kuzatishni to'xtatish" : "Kuzatishni yoqish"}
                    >
                      {item.active ? "O'chirish" : "Yoqish"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Yangi dori */}
      <Modal open={addOpen} title="Ro'yxatga dori qo'shish" onClose={() => setAddOpen(false)}>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const fd = new FormData(event.currentTarget);
            run(
              () =>
                addPriceWatch({
                  name: String(fd.get("name") ?? ""),
                  sourceUrl: String(fd.get("sourceUrl") ?? ""),
                }),
              () => setAddOpen(false),
            );
          }}
        >
          <Field label="Dori nomi">
            <Input name="name" required placeholder="КСАРЕЛТО" />
          </Field>
          <Field label="arzonapteka.uz havolasi">
            <Input name="sourceUrl" placeholder="https://arzonapteka.uz/uz/products/..." />
          </Field>
          <p className="text-xs text-muted">
            Havolani saytdan dorini topib, manzil satridan nusxalang. Keyin qo&apos;shsangiz ham bo&apos;ladi.
          </p>
          <SubmitButton pending={pending}>Qo&apos;shish</SubmitButton>
        </form>
      </Modal>

      {/* Havola biriktirish */}
      <Modal
        open={linking !== null}
        title={`Havola — ${linking?.name ?? ""}`}
        onClose={() => setLinking(null)}
      >
        {linking && (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const fd = new FormData(event.currentTarget);
              run(
                () => setPriceWatchUrl(linking.id, String(fd.get("sourceUrl") ?? "")),
                () => setLinking(null),
              );
            }}
          >
            <Field label="arzonapteka.uz havolasi">
              <Input name="sourceUrl" defaultValue={linking.sourceUrl ?? ""} placeholder="https://arzonapteka.uz/uz/products/..." />
            </Field>
            <a
              href={`https://arzonapteka.uz/uz/search?text=${encodeURIComponent(linking.name)}`}
              target="_blank"
              rel="noreferrer"
              className="block text-xs text-primary hover:underline"
            >
              &laquo;{linking.name}&raquo; ni saytda qidirish →
            </a>
            <SubmitButton pending={pending}>Saqlash</SubmitButton>
          </form>
        )}
      </Modal>
    </div>
  );
}
