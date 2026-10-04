import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { otdelUnitMap } from "@/lib/integrations/fapteka/otdel";
import { telegramUserFrom } from "@/lib/telegram-customer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dori qidirish: nomi, narxi va qaysi dorixonada borligi.
 * Qoldiq SITE.exe'dan (FaptekaPrice, har 5 daqiqa). Aniq soni ko'rsatilmaydi —
 * "bor" / "kam qoldi" / "yo'q".
 */
export async function GET(request: Request) {
  const auth = telegramUserFrom(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ ok: true, items: [] });

  const products = await db.product.findMany({
    where: { isActive: true, name: { contains: q, mode: "insensitive" }, sku: { startsWith: "FA:" } },
    select: { name: true, sku: true, salePrice: true, stock: true },
    orderBy: [{ stock: "desc" }, { name: "asc" }],
    take: 30,
  });

  const units = otdelUnitMap();
  const fids = products.map((p) => (p.sku ?? "").slice(3)).filter(Boolean);
  const stock = await db.faptekaPrice
    .findMany({ where: { fid: { in: fids } }, select: { otdel: true, fid: true, qty: true, price: true } })
    .catch(() => []);

  const items = products.map((p) => {
    const fid = (p.sku ?? "").slice(3);
    const at = [...new Set(units.values())].map((unit) => {
      const row = stock.find((s) => s.fid === fid && units.get(s.otdel) === unit);
      const qty = row ? Number(row.qty) : 0;
      return {
        unit,
        status: qty <= 0 ? "yoq" : qty <= 2 ? "kam" : "bor",
        price: row ? Number(row.price) : null,
      };
    });
    const prices = at.map((a) => a.price).filter((x): x is number => x !== null && x > 0);
    return {
      name: p.name,
      price: prices.length ? Math.min(...prices) : Number(p.salePrice),
      available: at.some((a) => a.status !== "yoq"),
      at,
    };
  });

  // Bor bo'lganlari birinchi
  items.sort((a, b) => Number(b.available) - Number(a.available));
  return NextResponse.json({ ok: true, items });
}
