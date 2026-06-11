"use client";

import { useMemo, useState, useTransition } from "react";
import { formatNumber } from "@/lib/format";
import { createSale, findCustomerByPhone, type SaleResult } from "@/lib/actions/pos";
import { createCustomer } from "@/lib/actions/customers";

type Product = { id: string; name: string; category: string; salePrice: number; stock: number };
type CartItem = { product: Product; quantity: number };
type Customer = { id: string; fullName: string | null; phone: string; points: number; tier: string; discount: number };

const TIER_LABEL: Record<string, string> = { BRONZE: "🥉 Bronza", SILVER: "🥈 Kumush", GOLD: "🥇 Oltin" };

export function PosTerminal({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [phone, setPhone] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerMsg, setCustomerMsg] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [regName, setRegName] = useState("");
  const [payment, setPayment] = useState<"CASH" | "CARD" | "MIXED">("CASH");
  const [receipt, setReceipt] = useState<Extract<SaleResult, { ok: true }> | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 8);
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, products]);

  const subtotal = cart.reduce((s, i) => s + i.product.salePrice * i.quantity, 0);
  const discount = customer ? Math.round((subtotal * customer.discount) / 100) : 0;
  const total = subtotal - discount;

  function addToCart(product: Product) {
    setReceipt(null);
    setCart((prev) => {
      const found = prev.find((i) => i.product.id === product.id);
      if (found) {
        if (found.quantity >= product.stock) return prev;
        return prev.map((i) => (i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function setQty(id: string, qty: number) {
    setCart((prev) =>
      prev
        .map((i) => (i.product.id === id ? { ...i, quantity: Math.max(0, Math.min(qty, i.product.stock)) } : i))
        .filter((i) => i.quantity > 0),
    );
  }

  function lookupCustomer() {
    setCustomerMsg("");
    setNotFound(false);
    startTransition(async () => {
      const c = await findCustomerByPhone(phone);
      if (c) {
        setCustomer(c);
        setCustomerMsg(`${c.fullName ?? "Mijoz"} — ${TIER_LABEL[c.tier]} · ${c.points} ball · ${c.discount}% chegirma`);
      } else {
        setCustomer(null);
        setNotFound(true);
        setCustomerMsg("Mijoz topilmadi — shu yerda ro'yxatdan o'tkazishingiz mumkin.");
      }
    });
  }

  function registerCustomer() {
    if (regName.trim().length < 2) return;
    startTransition(async () => {
      const res = await createCustomer({ fullName: regName.trim(), phone });
      if (res.ok) {
        const c = await findCustomerByPhone(phone);
        if (c) {
          setCustomer(c);
          setCustomerMsg(`${c.fullName} ro'yxatdan o'tdi 🎉 — ${TIER_LABEL[c.tier]} · ${c.points} ball`);
        }
        setNotFound(false);
        setRegName("");
      } else {
        setCustomerMsg(res.error);
      }
    });
  }

  function checkout() {
    setError("");
    setReceipt(null);
    startTransition(async () => {
      const res = await createSale({
        items: cart.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
        customerId: customer?.id ?? null,
        paymentMethod: payment,
      });
      if (res.ok) {
        setReceipt(res);
        setCart([]);
        setCustomer(null);
        setPhone("");
        setCustomerMsg("");
        setNotFound(false);
        setRegName("");
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
      {/* Mahsulot tanlash */}
      <div className="card p-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Dori nomini qidiring..."
          className="mb-3 w-full rounded-lg border border-edge bg-card px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              disabled={p.stock <= 0}
              className="rounded-lg border border-edge p-3 text-left transition hover:border-primary disabled:opacity-40"
            >
              <div className="text-sm font-medium leading-tight">{p.name}</div>
              <div className="mt-1 text-xs text-muted">{p.category}</div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-sm font-semibold text-primary">{formatNumber(p.salePrice)}</span>
                <span className="text-[11px] text-muted">{p.stock} dona</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Savatcha */}
      <div className="card flex flex-col p-4">
        <h3 className="mb-3 text-sm font-medium">🛒 Savatcha</h3>

        {cart.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">Mahsulot tanlang</p>
        ) : (
          <div className="mb-3 flex flex-col gap-2">
            {cart.map((i) => (
              <div key={i.product.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate">{i.product.name}</span>
                <input
                  type="number"
                  min={1}
                  max={i.product.stock}
                  value={i.quantity}
                  onChange={(e) => setQty(i.product.id, Number(e.target.value))}
                  className="w-12 rounded border border-edge px-1 py-0.5 text-center text-sm"
                />
                <span className="w-20 text-right font-medium">
                  {formatNumber(i.product.salePrice * i.quantity)}
                </span>
                <button onClick={() => setQty(i.product.id, 0)} className="text-muted hover:text-danger">
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Mijoz */}
        <div className="mb-3 border-t border-edge pt-3">
          <div className="flex gap-2">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Mijoz telefoni (ixtiyoriy)"
              className="flex-1 rounded-lg border border-edge px-3 py-1.5 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={lookupCustomer}
              disabled={isPending}
              className="rounded-lg border border-edge px-3 py-1.5 text-sm hover:bg-surface"
            >
              Topish
            </button>
          </div>
          {customerMsg && (
            <p className={`mt-1.5 text-xs ${customer ? "text-primary" : "text-muted"}`}>{customerMsg}</p>
          )}
          {notFound && !customer && (
            <div className="mt-2 flex gap-2">
              <input
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Mijoz ismi"
                className="flex-1 rounded-lg border border-edge px-3 py-1.5 text-sm outline-none focus:border-primary"
              />
              <button
                onClick={registerCustomer}
                disabled={isPending || regName.trim().length < 2}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                Ro'yxat
              </button>
            </div>
          )}
        </div>

        {/* To'lov turi */}
        <div className="mb-3 flex gap-1 rounded-lg bg-surface p-1">
          {(["CASH", "CARD", "MIXED"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setPayment(m)}
              className={`flex-1 rounded-md py-1.5 text-xs transition ${
                payment === m ? "bg-card font-medium shadow-sm" : "text-muted"
              }`}
            >
              {m === "CASH" ? "Naqd" : m === "CARD" ? "Terminal" : "Aralash"}
            </button>
          ))}
        </div>

        {/* Yakun */}
        <div className="mt-auto space-y-1 border-t border-edge pt-3 text-sm">
          <div className="flex justify-between text-muted">
            <span>Oraliq summa</span>
            <span>{formatNumber(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-primary">
              <span>Chegirma ({customer?.discount}%)</span>
              <span>−{formatNumber(discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold">
            <span>Jami</span>
            <span>{formatNumber(total)} so'm</span>
          </div>

          {error && <p className="rounded-lg bg-danger-light px-2 py-1.5 text-xs text-danger">{error}</p>}

          <button
            onClick={checkout}
            disabled={cart.length === 0 || isPending}
            className="mt-2 w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Saqlanmoqda..." : "Sotuvni yakunlash"}
          </button>

          {receipt && (
            <div className="mt-2 rounded-lg bg-primary-light p-3 text-xs">
              <div className="font-medium text-primary">✅ Chek: {receipt.receiptNo}</div>
              <div className="mt-1">Jami: {formatNumber(receipt.total)} so'm</div>
              {receipt.pointsEarned > 0 && (
                <div className="text-primary">+{receipt.pointsEarned} bonus ball qo'shildi</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
