"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { activeBranch, fail, requireUser, type ActionResult } from "./_shared";

const createSchema = z.object({
  name: z.string().min(2, "Nomi kamida 2 belgi"),
  category: z.string().min(2, "Kategoriya kiriting"),
  sku: z.string().optional(),
  costPrice: z.number().nonnegative(),
  salePrice: z.number().positive("Sotuv narxi musbat bo'lishi kerak"),
  stock: z.number().int().nonnegative(),
  minStock: z.number().int().nonnegative(),
  expiryDate: z.string().optional(),
});

export async function createProduct(input: z.input<typeof createSchema>): Promise<ActionResult> {
  try {
    await requireUser();
    const d = createSchema.parse(input);
    const branch = await activeBranch();
    await db.product.create({
      data: {
        name: d.name,
        category: d.category,
        sku: d.sku || null,
        costPrice: d.costPrice,
        salePrice: d.salePrice,
        stock: d.stock,
        minStock: d.minStock,
        expiryDate: d.expiryDate ? new Date(d.expiryDate) : null,
        branchId: branch.id,
        stockMovements:
          d.stock > 0
            ? { create: { type: "IN", quantity: d.stock, note: "Boshlang'ich qoldiq" } }
            : undefined,
      },
    });
    revalidatePath("/ombor");
    revalidatePath("/pos");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const updateSchema = z.object({
  id: z.string(),
  name: z.string().min(2),
  category: z.string().min(2),
  costPrice: z.number().nonnegative(),
  salePrice: z.number().positive(),
  minStock: z.number().int().nonnegative(),
});

export async function updateProduct(input: z.input<typeof updateSchema>): Promise<ActionResult> {
  try {
    await requireUser();
    const d = updateSchema.parse(input);
    await db.product.update({
      where: { id: d.id },
      data: {
        name: d.name,
        category: d.category,
        costPrice: d.costPrice,
        salePrice: d.salePrice,
        minStock: d.minStock,
      },
    });
    revalidatePath("/ombor");
    revalidatePath("/pos");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Yangi partiya qabul qilish — ombor ortadi + harakat yoziladi */
export async function receiveStock(input: {
  productId: string;
  quantity: number;
  expiryDate?: string;
}): Promise<ActionResult> {
  try {
    await requireUser();
    const quantity = z.number().int().positive().parse(input.quantity);
    await db.$transaction([
      db.product.update({
        where: { id: input.productId },
        data: {
          stock: { increment: quantity },
          ...(input.expiryDate ? { expiryDate: new Date(input.expiryDate) } : {}),
        },
      }),
      db.stockMovement.create({
        data: { productId: input.productId, type: "IN", quantity, note: "Yangi partiya" },
      }),
    ]);
    revalidatePath("/ombor");
    revalidatePath("/pos");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
