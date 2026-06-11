"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui";
import { Field, FormError, Input, Modal, PrimaryButton, SubmitButton } from "@/components/Modal";
import { createProduct, receiveStock, updateProduct } from "@/lib/actions/products";

type Product = {
  id: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  salePrice: number;
  costPrice: number;
  expiryDate: string | null;
  status: { label: string; color: "green" | "amber" | "red" };
};

export function InventoryPanel({ products }: { products: Product[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [receive, setReceive] = useState<Product | null>(null);
  const [edit, setEdit] = useState<Product | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q),
    );
  }, [products, query]);

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
        <span className="flex items-center gap-2 text-sm font-medium">🔍 Ombor jadvali</span>
        <div className="flex items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Dori nomi yoki kodi..."
            className="!w-56 !py-1.5 text-xs"
          />
          <PrimaryButton onClick={() => { setError(""); setAddOpen(true); }}>+ Yangi dori</PrimaryButton>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-edge text-left text-[11px] uppercase text-muted">
              <th className="pb-2 pr-3 font-medium">Mahsulot</th>
              <th className="pb-2 pr-3 font-medium">Kategoriya</th>
              <th className="pb-2 pr-3 font-medium">Qoldiq</th>
              <th className="pb-2 pr-3 font-medium">Min</th>
              <th className="pb-2 pr-3 font-medium">Narx</th>
              <th className="pb-2 pr-3 font-medium">Holat</th>
              <th className="pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-edge last:border-0 hover:bg-surface">
                <td className="py-2.5 pr-3 font-medium">{p.name}</td>
                <td className="py-2.5 pr-3 text-muted">{p.category}</td>
                <td className="py-2.5 pr-3">{p.stock} dona</td>
                <td className="py-2.5 pr-3 text-muted">{p.minStock}</td>
                <td className="py-2.5 pr-3">{formatNumber(p.salePrice)}</td>
                <td className="py-2.5 pr-3">
                  <Badge color={p.status.color}>{p.status.label}</Badge>
                </td>
                <td className="py-2.5 text-right whitespace-nowrap">
                  <button
                    onClick={() => { setError(""); setReceive(p); }}
                    className="rounded-md border border-edge px-2 py-1 text-xs hover:bg-surface"
                    title="Partiya qabul qilish"
                  >
                    📥
                  </button>
                  <button
                    onClick={() => { setError(""); setEdit(p); }}
                    className="ml-1 rounded-md border border-edge px-2 py-1 text-xs hover:bg-surface"
                    title="Tahrirlash"
                  >
                    ✏️
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-muted">
                  Hech narsa topilmadi
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Yangi dori */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Yangi dori qo'shish">
        <form
          action={(fd) =>
            run(
              () =>
                createProduct({
                  name: String(fd.get("name")),
                  category: String(fd.get("category")),
                  sku: String(fd.get("sku")) || undefined,
                  costPrice: Number(fd.get("costPrice")),
                  salePrice: Number(fd.get("salePrice")),
                  stock: Number(fd.get("stock")),
                  minStock: Number(fd.get("minStock")),
                  expiryDate: String(fd.get("expiryDate")) || undefined,
                }),
              () => setAddOpen(false),
            )
          }
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nomi">
              <Input name="name" required placeholder="Amoxicillin 500mg" />
            </Field>
            <Field label="Kategoriya">
              <Input name="category" required placeholder="Antibiotik" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kod (SKU)">
              <Input name="sku" placeholder="AMX-500" />
            </Field>
            <Field label="Muddati">
              <Input name="expiryDate" type="date" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tan narxi">
              <Input name="costPrice" type="number" min={0} required placeholder="3000" />
            </Field>
            <Field label="Sotuv narxi">
              <Input name="salePrice" type="number" min={1} required placeholder="4500" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Boshlang'ich qoldiq">
              <Input name="stock" type="number" min={0} defaultValue={0} required />
            </Field>
            <Field label="Min norma">
              <Input name="minStock" type="number" min={0} defaultValue={10} required />
            </Field>
          </div>
          <FormError message={error} />
          <SubmitButton pending={pending} />
        </form>
      </Modal>

      {/* Partiya qabul qilish */}
      <Modal open={!!receive} onClose={() => setReceive(null)} title={`Partiya qabul: ${receive?.name ?? ""}`}>
        {receive && (
          <form
            action={(fd) =>
              run(
                () =>
                  receiveStock({
                    productId: receive.id,
                    quantity: Number(fd.get("quantity")),
                    expiryDate: String(fd.get("expiryDate")) || undefined,
                  }),
                () => setReceive(null),
              )
            }
            className="space-y-3"
          >
            <p className="text-sm text-muted">Joriy qoldiq: {receive.stock} dona</p>
            <Field label="Qabul miqdori (dona)">
              <Input name="quantity" type="number" min={1} required placeholder="50" autoFocus />
            </Field>
            <Field label="Yangi muddat (ixtiyoriy)">
              <Input name="expiryDate" type="date" defaultValue={receive.expiryDate ?? ""} />
            </Field>
            <FormError message={error} />
            <SubmitButton pending={pending}>Qabul qilish</SubmitButton>
          </form>
        )}
      </Modal>

      {/* Tahrirlash */}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={`Tahrirlash: ${edit?.name ?? ""}`}>
        {edit && (
          <form
            action={(fd) =>
              run(
                () =>
                  updateProduct({
                    id: edit.id,
                    name: String(fd.get("name")),
                    category: String(fd.get("category")),
                    costPrice: Number(fd.get("costPrice")),
                    salePrice: Number(fd.get("salePrice")),
                    minStock: Number(fd.get("minStock")),
                  }),
                () => setEdit(null),
              )
            }
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nomi">
                <Input name="name" required defaultValue={edit.name} />
              </Field>
              <Field label="Kategoriya">
                <Input name="category" required defaultValue={edit.category} />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Tan narxi">
                <Input name="costPrice" type="number" min={0} required defaultValue={edit.costPrice} />
              </Field>
              <Field label="Sotuv narxi">
                <Input name="salePrice" type="number" min={1} required defaultValue={edit.salePrice} />
              </Field>
              <Field label="Min norma">
                <Input name="minStock" type="number" min={0} required defaultValue={edit.minStock} />
              </Field>
            </div>
            <FormError message={error} />
            <SubmitButton pending={pending} />
          </form>
        )}
      </Modal>
    </div>
  );
}
