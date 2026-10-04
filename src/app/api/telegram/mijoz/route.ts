import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { TIERS, spentToNextTier } from "@/lib/loyalty";
import { PHARMACIES } from "@/lib/pharmacies";
import { telegramUserFrom } from "@/lib/telegram-customer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mijozlar Mini App'i: bonus karta, ball, daraja va tarix.
 * Ro'yxatdan o'tmagan bo'lsa registered: false — botda /start bosiladi.
 */
export async function GET(request: Request) {
  const auth = telegramUserFrom(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const customer = await db.customer.findUnique({
    where: { telegramId: BigInt(auth.user.id) },
    include: { loyaltyTransactions: { orderBy: { createdAt: "desc" }, take: 30 } },
  });
  const pharmacies = PHARMACIES;

  if (!customer) {
    return NextResponse.json({ ok: true, registered: false, firstName: auth.user.first_name ?? "", pharmacies });
  }

  const totalSpent = Number(customer.totalSpent);
  const next = spentToNextTier(totalSpent);
  // Kassada skaner qilinadigan QR — karta raqami
  const qr = await QRCode.toString(customer.cardCode, { type: "svg", margin: 1, width: 220 });

  return NextResponse.json({
    ok: true,
    registered: true,
    pharmacies,
    customer: {
      fullName: customer.fullName,
      phone: customer.phone,
      cardCode: customer.cardCode,
      points: customer.points,
      tier: customer.tier,
      tierLabel: TIERS[customer.tier].label,
      tierEmoji: TIERS[customer.tier].emoji,
      discountPercent: TIERS[customer.tier].discountPercent,
      totalSpent,
      next: next
        ? { label: TIERS[next.nextTier].label, remaining: next.remaining, minSpent: TIERS[next.nextTier].minSpent }
        : null,
      qr,
    },
    history: customer.loyaltyTransactions.map((t) => ({
      id: t.id,
      type: t.type,
      points: t.points,
      note: t.note,
      createdAt: t.createdAt.toISOString(),
    })),
  });
}
