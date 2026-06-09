"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { pointsForPurchase, tierDiscount, tierForSpent } from "@/lib/loyalty";

const saleSchema = z.object({
  items: z
    .array(z.object({ productId: z.string(), quantity: z.number().int().positive() }))
    .min(1),
  customerId: z.string().nullish(),
  paymentMethod: z.enum(["CASH", "CARD", "MIXED"]).default("CASH"),
});

export type SaleResult =
  | {
      ok: true;
      receiptNo: string;
      subtotal: number;
      discount: number;
      total: number;
      pointsEarned: number;
    }
  | { ok: false; error: string };

/** Mijozni telefon raqami orqali topish */
export async function findCustomerByPhone(phone: string) {
  const clean = phone.trim();
  if (clean.length < 4) return null;
  const customer = await db.customer.findFirst({
    where: { phone: { contains: clean } },
    select: { id: true, fullName: true, phone: true, points: true, tier: true, totalSpent: true },
  });
  if (!customer) return null;
  return {
    id: customer.id,
    fullName: customer.fullName,
    phone: customer.phone,
    points: customer.points,
    tier: customer.tier,
    discount: tierDiscount(customer.tier),
  };
}

/** Yangi savdo — ombor kamayadi, mijoz ball to'playdi (bitta tranzaksiyada) */
export async function createSale(input: z.input<typeof saleSchema>): Promise<SaleResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Avtorizatsiya talab qilinadi" };

  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Noto'g'ri ma'lumot" };
  const { items, customerId, paymentMethod } = parsed.data;

  const branch = await db.branch.findFirst({ where: { isActive: true } });
  if (!branch) return { ok: false, error: "Filial topilmadi" };

  // Sotuvchi xodim (agar foydalanuvchi xodimga bog'langan bo'lsa)
  const employee = await db.employee.findUnique({ where: { userId: session.user.id ?? "" } });

  try {
    const result = await db.$transaction(async (tx) => {
      const productIds = items.map((i) => i.productId);
      const products = await tx.product.findMany({ where: { id: { in: productIds } } });
      const map = new Map(products.map((p) => [p.id, p]));

      let subtotal = 0;
      const saleItemsData = [];
      for (const item of items) {
        const product = map.get(item.productId);
        if (!product) throw new Error("Mahsulot topilmadi");
        if (product.stock < item.quantity)
          throw new Error(`"${product.name}" — yetarli qoldiq yo'q (${product.stock} dona)`);

        const unitPrice = Number(product.salePrice);
        const costPrice = Number(product.costPrice);
        const lineTotal = unitPrice * item.quantity;
        subtotal += lineTotal;
        saleItemsData.push({
          productId: product.id,
          quantity: item.quantity,
          unitPrice,
          costPrice,
          lineTotal,
        });
      }

      // Mijoz va daraja chegirmasi
      let customer = customerId
        ? await tx.customer.findUnique({ where: { id: customerId } })
        : null;
      const discountPercent = customer ? tierDiscount(customer.tier) : 0;
      const discount = Math.round((subtotal * discountPercent) / 100);
      const total = subtotal - discount;
      const pointsEarned = customer ? pointsForPurchase(total) : 0;

      const receiptNo = `CHK-${Date.now()}`;

      const sale = await tx.sale.create({
        data: {
          receiptNo,
          total,
          discount,
          pointsEarned,
          paymentMethod,
          branchId: branch.id,
          employeeId: employee?.id ?? null,
          customerId: customer?.id ?? null,
          items: { create: saleItemsData },
        },
      });

      // Ombordan kamaytirish + harakat yozuvi
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
        await tx.stockMovement.create({
          data: { productId: item.productId, type: "OUT", quantity: item.quantity, note: receiptNo },
        });
      }

      // Mijoz ballari va darajasini yangilash
      if (customer) {
        const newSpent = Number(customer.totalSpent) + total;
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            points: { increment: pointsEarned },
            totalSpent: newSpent,
            tier: tierForSpent(newSpent),
          },
        });
        await tx.loyaltyTransaction.create({
          data: {
            customerId: customer.id,
            type: "EARN",
            points: pointsEarned,
            saleId: sale.id,
            note: `Xarid: ${receiptNo}`,
          },
        });
      }

      return { receiptNo, subtotal, discount, total, pointsEarned };
    });

    revalidatePath("/ombor");
    revalidatePath("/moliya");
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Xatolik yuz berdi" };
  }
}
