import "server-only";
import { db } from "@/lib/db";

/**
 * Narx nazorati: raqobatchidagi (arzonapteka.uz) eng arzon narxni kuzatadi.
 *
 * Narx mahsulot sahifasining ochiq ma'lumotidan olinadi — o'sha yerda
 * "narxi 264 800 soʻmdan" deb yozilgan, ya'ni Toshkentdagi eng arzon taklif.
 * Saytning yopiq API'siga tegilmaydi (robots.txt da /api/ taqiqlangan).
 *
 * Sahifalar birma-bir, orasida kutib olinadi — raqobatchi serveriga
 * ortiqcha yuk tushmasin.
 */

const REQUEST_DELAY_MS = 800;
const USER_AGENT = "EvomedApteka-PriceWatch/1.0 (+https://dorixonaa.vercel.app)";
/** Shuncha soatdan eski bo'lsa yangilanadi */
export const PRICE_STALE_HOURS = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Sahifadan eng arzon narxni va to'liq nomni oladi */
export async function fetchCompetitorPrice(url: string) {
  // O'zbekcha sahifada narx "narxi 264 800 soʻmdan" ko'rinishida yoziladi
  const target = url.replace("/ru/products/", "/uz/products/");
  const response = await fetch(target, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "uz" },
    cache: "no-store",
  });
  if (!response.ok) return { ok: false as const, error: `HTTP ${response.status}` };

  const html = await response.text();
  const description = html.match(/<meta name="description" content="([^"]{0,500})"/)?.[1] ?? "";
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";

  const matched = description.match(/narxi\s*([0-9][0-9\s ]*)/);
  if (!matched) return { ok: false as const, error: "Narx topilmadi" };

  const price = Number(matched[1].replace(/\D/g, ""));
  if (!Number.isFinite(price) || price <= 0) return { ok: false as const, error: "Narx o'qilmadi" };

  return {
    ok: true as const,
    price,
    title: title.split("—")[0].trim().slice(0, 160),
  };
}

/** Nomi bo'yicha bizning tovarni topadi (F-Apteka tovarlari orasidan) */
async function findOurProduct(name: string) {
  const product = await db.product.findFirst({
    where: { isActive: true, sku: { startsWith: "FA:" }, name: { startsWith: name, mode: "insensitive" } },
    orderBy: { stock: "desc" },
    select: { sku: true },
  });
  return product?.sku ?? null;
}

/**
 * Eskirgan yozuvlarni yangilaydi. Bir chaqiruvda ozdan olamiz —
 * Vercel'ning 60 soniyasiga sig'sin va sayt ham bosim ko'rmasin.
 */
export async function refreshPriceWatch(limit = 12) {
  const staleEdge = new Date(Date.now() - PRICE_STALE_HOURS * 3600 * 1000);

  const items = await db.priceWatch.findMany({
    where: {
      active: true,
      sourceUrl: { not: null },
      OR: [{ checkedAt: null }, { checkedAt: { lt: staleEdge } }],
    },
    orderBy: [{ checkedAt: { sort: "asc", nulls: "first" } }, { name: "asc" }],
    take: limit,
  });

  let updated = 0;
  const errors: string[] = [];

  for (const item of items) {
    try {
      const result = await fetchCompetitorPrice(item.sourceUrl as string);
      if (!result.ok) {
        errors.push(`${item.name}: ${result.error}`);
        // Xato bo'lsa ham vaqtini belgilaymiz, aks holda navbat tiqilib qoladi
        await db.priceWatch.update({ where: { id: item.id }, data: { checkedAt: new Date() } });
      } else {
        const sku = item.sku ?? (await findOurProduct(item.name));
        await db.priceWatch.update({
          where: { id: item.id },
          data: {
            competitorPrice: result.price,
            sourceTitle: result.title,
            checkedAt: new Date(),
            sku,
          },
        });
        updated += 1;
      }
    } catch (error) {
      errors.push(`${item.name}: ${error instanceof Error ? error.message : "xato"}`);
    }
    await sleep(REQUEST_DELAY_MS);
  }

  return { ok: errors.length === 0, checked: items.length, updated, errors };
}
