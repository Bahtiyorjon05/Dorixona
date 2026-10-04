"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatDate, formatNumber } from "@/lib/format";

type Pharmacy = { unit: string; name: string; address: string; phone: string; hours: string; map: string };
type CardData = {
  ok: boolean;
  error?: string;
  registered?: boolean;
  firstName?: string;
  pharmacies: Pharmacy[];
  customer?: {
    fullName: string | null;
    cardCode: string;
    points: number;
    tierLabel: string;
    tierEmoji: string;
    discountPercent: number;
    totalSpent: number;
    next: { label: string; remaining: number; minSpent: number } | null;
    qr: string;
  };
  history?: { id: string; type: string; points: number; note: string | null; createdAt: string }[];
};
type SearchItem = {
  name: string;
  price: number;
  available: boolean;
  at: { unit: string; status: "bor" | "kam" | "yoq"; price: number | null }[];
};

const SCRIPT = "https://telegram.org/js/telegram-web-app.js";
const TYPE_LABEL: Record<string, string> = {
  EARN: "Xarid uchun",
  REDEEM: "Ishlatildi",
  SIGNUP_BONUS: "Ro'yxatdan o'tish bonusi",
  ADJUST: "Tuzatish",
};
const STATUS: Record<string, { text: string; color: string }> = {
  bor: { text: "Bor", color: "var(--c-primary)" },
  kam: { text: "Kam qoldi", color: "var(--c-accent)" },
  yoq: { text: "Yo'q", color: "var(--c-muted)" },
};

function loadTelegram(): Promise<void> {
  if (typeof window === "undefined" || window.Telegram?.WebApp) return Promise.resolve();
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
    window.setTimeout(resolve, 6000);
  });
}

const som = (value: number) => `${formatNumber(Math.round(value))} so'm`;

export function MijozClient() {
  const [initData, setInitData] = useState("");
  const [data, setData] = useState<CardData | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"karta" | "qidiruv" | "dorixonalar">("karta");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SearchItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadTelegram();
      const webApp = window.Telegram?.WebApp;
      webApp?.ready();
      webApp?.expand();
      const init = webApp?.initData ?? "";
      if (!init) {
        setError("Bu sahifa Telegram ichida ochiladi: botda «Mening kartam» tugmasini bosing.");
        return;
      }
      setInitData(init);
      try {
        const res = await fetch("/api/telegram/mijoz", { headers: { Authorization: `tma ${init}` } });
        const body = (await res.json()) as CardData;
        if (!cancelled) {
          if (!res.ok || !body.ok) setError(body.error ?? "Ma'lumot yuklanmadi");
          else setData(body);
        }
      } catch {
        if (!cancelled) setError("Internetni tekshiring va qayta oching.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Dori qidirish — yozish to'xtagach 400 ms
  useEffect(() => {
    window.clearTimeout(timer.current);
    const q = query.trim();
    if (q.length < 2 || !initData) {
      setItems(null);
      return;
    }
    timer.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/telegram/mijoz/qidiruv?q=${encodeURIComponent(q)}`, {
          headers: { Authorization: `tma ${initData}` },
        });
        const body = (await res.json()) as { ok: boolean; items?: SearchItem[] };
        setItems(body.items ?? []);
      } catch {
        setItems([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }, [query, initData]);

  const progress = useMemo(() => {
    const c = data?.customer;
    if (!c?.next) return 100;
    return Math.min(100, Math.round((c.totalSpent / c.next.minSpent) * 100));
  }, [data]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface p-6 text-center text-fg">
        <div className="card max-w-sm p-6 text-sm">{error}</div>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface text-sm text-muted">Yuklanmoqda…</main>
    );
  }

  const c = data.customer;
  const pharmacies = data.pharmacies;

  return (
    <main className="min-h-screen bg-surface pb-20 text-fg">
      <div className="mx-auto max-w-md p-4">
        {tab === "karta" && (
          !data.registered || !c ? (
            <div className="card mt-6 p-6 text-center">
              <div className="text-4xl">💊</div>
              <h1 className="mt-3 text-lg font-semibold">Assalomu alaykum{data.firstName ? `, ${data.firstName}` : ""}!</h1>
              <p className="mt-2 text-sm text-muted">
                Bonus kartangizni olish uchun botga qayting va telefon raqamingizni ulashing (/start).
              </p>
              <button
                type="button"
                onClick={() => (window.Telegram?.WebApp as { close?: () => void } | undefined)?.close?.()}
                className="mt-4 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white"
              >
                Botga qaytish
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div
                className="rounded-2xl p-5 text-white shadow"
                style={{ background: "linear-gradient(135deg, var(--c-primary), #1b2f8f)" }}
              >
                <div className="flex items-center justify-between text-sm opacity-90">
                  <span>Evomed apteka</span>
                  <span>
                    {c.tierEmoji} {c.tierLabel}
                  </span>
                </div>
                <div className="mt-4 text-3xl font-bold">{formatNumber(c.points)} ball</div>
                <div className="mt-1 text-sm opacity-90">{c.fullName}</div>
                <div className="mt-3 font-mono text-lg tracking-widest">{c.cardCode}</div>
                {c.discountPercent > 0 && <div className="mt-1 text-xs opacity-90">Chegirma: {c.discountPercent}%</div>}
              </div>

              <div className="card flex flex-col items-center p-4">
                <div className="rounded-xl bg-white p-2" dangerouslySetInnerHTML={{ __html: c.qr }} />
                <p className="mt-2 text-xs text-muted">Kassada shu kodni ko&apos;rsating</p>
              </div>

              {c.next && (
                <div className="card p-4">
                  <div className="flex justify-between text-sm">
                    <span>{c.next.label} darajagacha</span>
                    <span className="text-muted">{som(c.next.remaining)} qoldi</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}

              <div className="card p-4">
                <div className="mb-2 text-sm font-medium">Ballar tarixi</div>
                {data.history?.length ? (
                  <div className="divide-y divide-edge">
                    {data.history.map((h) => (
                      <div key={h.id} className="flex items-center justify-between py-2 text-sm">
                        <div>
                          <div>{TYPE_LABEL[h.type] ?? h.type}</div>
                          <div className="text-xs text-muted">
                            {formatDate(h.createdAt)}
                            {h.note ? ` · ${h.note}` : ""}
                          </div>
                        </div>
                        <span style={{ color: h.points >= 0 ? "var(--c-primary)" : "var(--c-danger)" }}>
                          {h.points >= 0 ? "+" : ""}
                          {formatNumber(h.points)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">Hali harakat yo&apos;q.</p>
                )}
              </div>
            </div>
          )
        )}

        {tab === "qidiruv" && (
          <div className="space-y-3">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Dori nomini yozing…"
              className="w-full rounded-xl border border-edge bg-card px-4 py-3 text-sm outline-none focus:border-primary"
            />
            {searching && <p className="text-center text-xs text-muted">Qidirilmoqda…</p>}
            {items && !searching && items.length === 0 && (
              <p className="text-center text-sm text-muted">Topilmadi.</p>
            )}
            {items?.map((item) => (
              <div key={item.name} className="card p-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium">{item.name}</span>
                  <span className="whitespace-nowrap text-sm font-semibold">{som(item.price)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.at.map((a) => (
                    <span
                      key={a.unit}
                      className="rounded-full border border-edge px-2.5 py-0.5 text-xs"
                      style={{ color: STATUS[a.status].color }}
                    >
                      {a.unit}: {STATUS[a.status].text}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "dorixonalar" && (
          <div className="space-y-3">
            {pharmacies.map((p) => (
              <div key={p.unit} className="card p-4 text-sm">
                <div className="font-semibold">{p.name}</div>
                {p.address && <div className="mt-1 text-muted">📍 {p.address}</div>}
                {p.hours && <div className="mt-1 text-muted">🕐 {p.hours}</div>}
                {p.phone && (
                  <a href={`tel:${p.phone.replace(/\s/g, "")}`} className="mt-1 block text-primary">
                    📞 {p.phone}
                  </a>
                )}
                {p.map && (
                  <a href={p.map} target="_blank" rel="noreferrer" className="mt-1 block text-primary">
                    🗺️ Xaritada ochish
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <nav className="fixed inset-x-0 bottom-0 border-t border-edge bg-card">
        <div className="mx-auto grid max-w-md grid-cols-3 text-xs">
          {[
            ["karta", "🪪", "Karta"],
            ["qidiruv", "🔍", "Dori qidirish"],
            ["dorixonalar", "📍", "Dorixonalar"],
          ].map(([key, icon, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key as typeof tab)}
              className={`flex flex-col items-center gap-0.5 py-2.5 ${tab === key ? "text-primary" : "text-muted"}`}
            >
              <span className="text-lg">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}
