import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { latePenalty, bonusAmount, bonusPercentForScore, computeTotalScore } from "@/lib/kpi";
import { makeCardCode, pointsForPurchase, tierDiscount, tierForSpent } from "@/lib/loyalty";
import { canEdit, verifyRequestAccess } from "@/lib/request-access";
import type { AppPermission } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const num = z.coerce.number();
const int = z.coerce.number().int();
const score = int.min(0).max(100);

async function activeBranch() {
  const branch = await db.branch.findFirst({ where: { isActive: true } });
  if (!branch) throw new Error("Filial topilmadi");
  return branch;
}

function cleanPhone(phone: string) {
  return phone.startsWith("+") ? phone : `+${phone.replace(/^\+?/, "")}`;
}

const schemas = {
  createEmployee: z.object({
    fullName: z.string().min(3),
    position: z.string().min(2),
    phone: z.string().optional(),
    baseSalary: num.nonnegative(),
  }),
  createProduct: z.object({
    name: z.string().min(2),
    category: z.string().min(2),
    sku: z.string().optional(),
    costPrice: num.nonnegative(),
    salePrice: num.positive(),
    stock: int.nonnegative(),
    minStock: int.nonnegative(),
    expiryDate: z.string().optional(),
  }),
  createExpense: z.object({
    title: z.string().min(2),
    category: z.enum(["RENT", "UTILITIES", "GOODS", "SALARY", "LICENSE", "OTHER"]),
    amount: num.positive(),
    spentAt: z.string().optional(),
    isRecurring: z.coerce.boolean().default(false),
  }),
  createCustomer: z.object({
    fullName: z.string().min(2),
    phone: z.string().min(7),
    birthday: z.string().optional(),
  }),
  createSale: z.object({
    productId: z.string().min(1),
    quantity: int.positive(),
    customerId: z.string().optional(),
    employeeId: z.string().optional(),
    paymentMethod: z.enum(["CASH", "CARD", "MIXED"]).default("CASH"),
  }),
  markAttendance: z.object({
    employeeId: z.string().min(1),
    status: z.enum(["PRESENT", "ABSENT", "ON_LEAVE"]),
    checkInTime: z.string().optional(),
  }),
  saveKpi: z.object({
    employeeId: z.string().min(1),
    salesScore: score,
    marginScore: score,
    attendanceScore: score,
    disciplineScore: score,
    customerScore: score,
  }),
};

async function createEmployee(payload: unknown) {
  const d = schemas.createEmployee.parse(payload);
  const branch = await activeBranch();
  await db.employee.create({
    data: {
      fullName: d.fullName,
      position: d.position,
      phone: d.phone || null,
      baseSalary: d.baseSalary,
      branchId: branch.id,
    },
  });
  return "Xodim qo'shildi";
}

async function createProduct(payload: unknown) {
  const d = schemas.createProduct.parse(payload);
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
          ? { create: { type: "IN", quantity: d.stock, note: "Mini App boshlang'ich qoldiq" } }
          : undefined,
    },
  });
  return "Mahsulot qo'shildi";
}

async function createExpense(payload: unknown) {
  const d = schemas.createExpense.parse(payload);
  const branch = await activeBranch();
  await db.expense.create({
    data: {
      title: d.title,
      category: d.category,
      amount: d.amount,
      spentAt: d.spentAt ? new Date(d.spentAt) : new Date(),
      isRecurring: d.isRecurring,
      branchId: branch.id,
    },
  });
  return "Xarajat qo'shildi";
}

async function createCustomer(payload: unknown) {
  const d = schemas.createCustomer.parse(payload);
  const branch = await activeBranch();
  const phone = cleanPhone(d.phone);
  const exists = await db.customer.findUnique({ where: { phone } });
  if (exists) throw new Error("Bu telefon raqami allaqachon bor");

  const count = await db.customer.count();
  await db.customer.create({
    data: {
      fullName: d.fullName,
      phone,
      cardCode: makeCardCode(101 + count),
      birthday: d.birthday ? new Date(d.birthday) : null,
      registeredVia: "manual",
      branchId: branch.id,
    },
  });
  return "Mijoz qo'shildi";
}

async function createSale(payload: unknown) {
  const d = schemas.createSale.parse(payload);
  const branch = await activeBranch();

  const result = await db.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: d.productId } });
    if (!product || !product.isActive) throw new Error("Mahsulot topilmadi");
    if (product.stock < d.quantity) throw new Error(`Qoldiq yetarli emas: ${product.stock} dona`);

    const customer = d.customerId ? await tx.customer.findUnique({ where: { id: d.customerId } }) : null;
    const employee = d.employeeId ? await tx.employee.findUnique({ where: { id: d.employeeId } }) : null;

    const subtotal = Number(product.salePrice) * d.quantity;
    const discount = customer ? Math.round((subtotal * tierDiscount(customer.tier)) / 100) : 0;
    const total = subtotal - discount;
    const pointsEarned = customer ? pointsForPurchase(total) : 0;
    const receiptNo = `CHK-${Date.now()}`;

    const sale = await tx.sale.create({
      data: {
        receiptNo,
        total,
        discount,
        pointsEarned,
        paymentMethod: d.paymentMethod,
        branchId: branch.id,
        employeeId: employee?.id ?? null,
        customerId: customer?.id ?? null,
        items: {
          create: {
            productId: product.id,
            quantity: d.quantity,
            unitPrice: Number(product.salePrice),
            costPrice: Number(product.costPrice),
            lineTotal: subtotal,
          },
        },
      },
    });

    await tx.product.update({
      where: { id: product.id },
      data: { stock: { decrement: d.quantity } },
    });
    await tx.stockMovement.create({
      data: { productId: product.id, type: "OUT", quantity: d.quantity, note: receiptNo },
    });

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

    return receiptNo;
  });

  return `Savdo saqlandi: ${result}`;
}

async function markAttendance(payload: unknown) {
  const d = schemas.markAttendance.parse(payload);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let checkIn: Date | null = null;
  let lateMinutes = 0;
  let penalty = 0;

  if (d.status === "PRESENT") {
    const [h, m] = (d.checkInTime || `${now.getHours()}:${now.getMinutes()}`).split(":").map(Number);
    checkIn = new Date(today);
    checkIn.setHours(h, m, 0, 0);
    lateMinutes = Math.max(0, h * 60 + m - 9 * 60);
    penalty = latePenalty(lateMinutes);
  }

  await db.attendance.upsert({
    where: { employeeId_date: { employeeId: d.employeeId, date: today } },
    create: {
      employeeId: d.employeeId,
      date: today,
      checkIn,
      lateMinutes,
      penalty,
      status: d.status === "PRESENT" && lateMinutes > 5 ? "LATE" : d.status,
    },
    update: {
      checkIn,
      lateMinutes,
      penalty,
      status: d.status === "PRESENT" && lateMinutes > 5 ? "LATE" : d.status,
    },
  });
  return "Davomat saqlandi";
}

async function saveKpi(payload: unknown) {
  const d = schemas.saveKpi.parse(payload);
  const employee = await db.employee.findUnique({ where: { id: d.employeeId } });
  if (!employee) throw new Error("Xodim topilmadi");

  const totalScore = computeTotalScore(d);
  const bonusPercent = bonusPercentForScore(totalScore);
  const amount = bonusAmount(Number(employee.baseSalary), totalScore);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  await db.kpiRecord.upsert({
    where: { employeeId_year_month: { employeeId: d.employeeId, year, month } },
    create: { ...d, year, month, totalScore, bonusPercent, bonusAmount: amount },
    update: { ...d, totalScore, bonusPercent, bonusAmount: amount },
  });
  return "KPI saqlandi";
}

const actions = {
  createEmployee,
  createProduct,
  createExpense,
  createCustomer,
  createSale,
  markAttendance,
  saveKpi,
};
const actionPermissions: Record<keyof typeof actions, AppPermission> = {
  createEmployee: "xodimlar",
  createProduct: "ombor",
  createExpense: "harajatlar",
  createCustomer: "mijozlar",
  createSale: "pos",
  markAttendance: "davomat",
  saveKpi: "kpi",
};

export async function POST(req: NextRequest) {
  const access = await verifyRequestAccess(req);
  if (!access.ok) {
    return Response.json({ ok: false, error: access.error }, { status: access.status });
  }

  try {
    const body = (await req.json()) as { action?: keyof typeof actions; payload?: unknown };
    if (!body.action || !(body.action in actions)) throw new Error("Noto'g'ri action");
    if (!canEdit(access, actionPermissions[body.action])) {
      return Response.json({ ok: false, error: "Bu bo'limni o'zgartirishga ruxsat yo'q" }, { status: 403 });
    }
    const message = await actions[body.action](body.payload);
    return Response.json({ ok: true, message });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "Xatolik yuz berdi" },
      { status: 400 },
    );
  }
}
