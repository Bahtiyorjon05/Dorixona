import { readFileSync } from "node:fs";
import { config as loadEnv, parse as parseEnv } from "dotenv";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { computeTotalScore, bonusPercentForScore } from "../src/lib/kpi";
import { createPrismaPgAdapter } from "../src/lib/postgres";

loadEnv();
try {
  const localEnv = parseEnv(readFileSync(".env.local"));
  for (const [key, value] of Object.entries(localEnv)) {
    if (value) process.env[key] = value;
  }
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const adapter = createPrismaPgAdapter();
const db = new PrismaClient({ adapter });

// ─── Yordamchilar ───
const rnd = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[rnd(0, arr.length - 1)];
const tierForSpent = (s: number) =>
  s >= 2_000_000 ? "GOLD" : s >= 500_000 ? "SILVER" : "BRONZE";

async function main() {
  console.log("🌱 Ma'lumotlar tozalanmoqda...");
  // FK xavfsiz tartibda tozalash
  await db.loyaltyTransaction.deleteMany();
  await db.saleItem.deleteMany();
  await db.sale.deleteMany();
  await db.stockMovement.deleteMany();
  await db.attendance.deleteMany();
  await db.kpiRecord.deleteMany();
  await db.expense.deleteMany();
  await db.product.deleteMany();
  await db.customer.deleteMany();
  await db.employee.deleteMany();
  await db.user.deleteMany();
  await db.branch.deleteMany();

  // ─── Filial ───
  const branch = await db.branch.create({
    data: {
      name: "Chilonzor filiali",
      address: "Toshkent sh., Chilonzor tumani",
      phone: "+998 71 200 00 00",
    },
  });

  // ─── Foydalanuvchilar (dashboard'ga kirish) ───
  const ownerPass = await bcrypt.hash("qwertz123", 10);
  await db.user.create({
    data: {
      email: "admin@dorixona.uz",
      passwordHash: ownerPass,
      fullName: "Dorixona egasi",
      role: "OWNER",
      branchId: branch.id,
    },
  });
  console.log("👤 Admin: admin@dorixona.uz / qwertz123");

  // ─── Xodimlar ───
  const employeesData = [
    { fullName: "Dilshod Xolmatov", position: "Farmatsevt", baseSalary: 4_500_000, status: "ACTIVE" as const },
    { fullName: "Nigora Karimova", position: "Kassa xodimi", baseSalary: 3_200_000, status: "ACTIVE" as const },
    { fullName: "Aziza Toshmatova", position: "Farmatsevt", baseSalary: 4_200_000, status: "ACTIVE" as const },
    { fullName: "Bobur Rahimov", position: "Kassa xodimi", baseSalary: 3_000_000, status: "ON_LEAVE" as const },
  ];
  const employees = [];
  for (const e of employeesData) {
    employees.push(
      await db.employee.create({ data: { ...e, branchId: branch.id } }),
    );
  }

  // ─── Mahsulotlar (ombor) ───
  const now = new Date();
  const daysFromNow = (d: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
  const productsData = [
    { name: "Amoxicillin 500mg", category: "Antibiotik", sku: "AMX-500", cost: 3000, sale: 4500, stock: 142, min: 50, expiry: daysFromNow(220) },
    { name: "Paracetamol 500mg", category: "Og'riq qoldiruvchi", sku: "PAR-500", cost: 800, sale: 1200, stock: 23, min: 100, expiry: daysFromNow(120) },
    { name: "Vitamin C 1000mg", category: "Vitaminlar", sku: "VTC-1000", cost: 6000, sale: 8900, stock: 87, min: 50, expiry: daysFromNow(400) },
    { name: "Ibuprofen 400mg", category: "Og'riq qoldiruvchi", sku: "IBU-400", cost: 1800, sale: 2800, stock: 45, min: 50, expiry: daysFromNow(180) },
    { name: "Omeprazole 20mg", category: "Oshqozon", sku: "OME-20", cost: 4000, sale: 6200, stock: 8, min: 30, expiry: daysFromNow(25) },
    { name: "Aspirin 100mg", category: "Yurak-qon tomir", sku: "ASP-100", cost: 900, sale: 1500, stock: 210, min: 60, expiry: daysFromNow(300) },
    { name: "Loratadin 10mg", category: "Allergiya", sku: "LOR-10", cost: 1500, sale: 2400, stock: 64, min: 40, expiry: daysFromNow(150) },
    { name: "Metformin 850mg", category: "Diabet", sku: "MET-850", cost: 2200, sale: 3600, stock: 38, min: 40, expiry: daysFromNow(20) },
    { name: "Tsitramon", category: "Og'riq qoldiruvchi", sku: "CIT-001", cost: 600, sale: 1100, stock: 156, min: 50, expiry: daysFromNow(260) },
    { name: "Vitamin D3 2000IU", category: "Vitaminlar", sku: "VTD-2000", cost: 7000, sale: 11000, stock: 29, min: 30, expiry: daysFromNow(500) },
  ];
  const products = [];
  for (const p of productsData) {
    products.push(
      await db.product.create({
        data: {
          name: p.name,
          category: p.category,
          sku: p.sku,
          costPrice: p.cost,
          salePrice: p.sale,
          stock: p.stock,
          minStock: p.min,
          expiryDate: p.expiry,
          branchId: branch.id,
        },
      }),
    );
  }

  // ─── Harajatlar ───
  // Joriy oy — batafsil ro'yxat
  const expensesData = [
    { title: "Ijara — Chilonzor filiali", category: "RENT" as const, amount: 8_000_000, recurring: true, day: -9 },
    { title: "Elektr va gaz", category: "UTILITIES" as const, amount: 1_240_000, recurring: false, day: -7 },
    { title: "Tovar yetkazib berish", category: "GOODS" as const, amount: 3_500_000, recurring: false, day: -5 },
    { title: "Maosh fondi", category: "SALARY" as const, amount: 18_500_000, recurring: true, day: -5 },
    { title: "Litsenziya yangilash", category: "LICENSE" as const, amount: 960_000, recurring: false, day: -3 },
    { title: "Internet va aloqa", category: "UTILITIES" as const, amount: 450_000, recurring: true, day: -2 },
  ];
  for (const e of expensesData) {
    await db.expense.create({
      data: {
        title: e.title,
        category: e.category,
        amount: e.amount,
        isRecurring: e.recurring,
        spentAt: daysFromNow(e.day),
        branchId: branch.id,
      },
    });
  }
  // O'tgan 6 oy — doimiy xarajatlar (grafik uchun)
  for (let m = 1; m <= 6; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 5);
    const rentVar = 8_000_000;
    const salaryVar = 16_500_000 + m * 200_000;
    const utilVar = 1_400_000 + rnd(-200_000, 300_000);
    const goodsVar = 3_000_000 + rnd(-500_000, 1_500_000);
    await db.expense.createMany({
      data: [
        { title: "Ijara", category: "RENT", amount: rentVar, isRecurring: true, spentAt: d, branchId: branch.id },
        { title: "Maosh fondi", category: "SALARY", amount: salaryVar, isRecurring: true, spentAt: d, branchId: branch.id },
        { title: "Kommunal", category: "UTILITIES", amount: utilVar, isRecurring: true, spentAt: d, branchId: branch.id },
        { title: "Tovar", category: "GOODS", amount: goodsVar, isRecurring: false, spentAt: d, branchId: branch.id },
      ],
    });
  }

  // ─── Mijozlar (Telegram orqali ro'yxatdan o'tgan) ───
  const customersData = [
    { fullName: "Sardor Aliyev", phone: "+998901112233", spent: 2_450_000 },
    { fullName: "Malika Yusupova", phone: "+998901112244", spent: 780_000 },
    { fullName: "Jasur Tursunov", phone: "+998901112255", spent: 120_000 },
    { fullName: "Kamola Saidova", phone: "+998901112266", spent: 3_100_000 },
  ];
  const customers = [];
  let cardSeq = 100;
  for (const c of customersData) {
    cardSeq++;
    customers.push(
      await db.customer.create({
        data: {
          fullName: c.fullName,
          phone: c.phone,
          cardCode: `FP-${String(cardSeq).padStart(5, "0")}`,
          totalSpent: c.spent,
          tier: tierForSpent(c.spent),
          points: Math.floor(c.spent / 10_000),
          branchId: branch.id,
        },
      }),
    );
  }

  // ─── Savdo tarixi (so'nggi 180 kun) — grafiklar uchun ───
  console.log("💰 Savdo tarixi yaratilmoqda...");
  const activeEmployees = employees.filter((e) => e.status === "ACTIVE");
  const sales: any[] = [];
  const saleItems: any[] = [];
  let receiptSeq = 1000;

  for (let d = 180; d >= 0; d--) {
    const date = daysFromNow(-d);
    const weekday = date.getDay();
    // Yakshanba kamroq, juma-shanba ko'proq savdo
    const base = weekday === 0 ? 4 : weekday === 5 || weekday === 6 ? 11 : 8;
    const count = rnd(base - 2, base + 2);

    for (let s = 0; s < count; s++) {
      const saleId = randomUUID();
      receiptSeq++;
      const itemCount = rnd(1, 3);
      const usedProducts = new Set<number>();
      let total = 0;

      for (let i = 0; i < itemCount; i++) {
        let pi = rnd(0, products.length - 1);
        if (usedProducts.has(pi)) continue;
        usedProducts.add(pi);
        const product = products[pi];
        const qty = rnd(1, 3);
        const unitPrice = Number(product.salePrice);
        const costPrice = Number(product.costPrice);
        const lineTotal = unitPrice * qty;
        total += lineTotal;
        saleItems.push({
          id: randomUUID(),
          saleId,
          productId: product.id,
          quantity: qty,
          unitPrice,
          costPrice,
          lineTotal,
        });
      }

      const employee = pick(activeEmployees);
      const withCustomer = Math.random() < 0.35;
      const createdAt = new Date(date);
      createdAt.setHours(rnd(9, 20), rnd(0, 59), 0, 0);

      sales.push({
        id: saleId,
        receiptNo: `CHK-${receiptSeq}`,
        total,
        discount: 0,
        pointsEarned: Math.floor(total / 10_000),
        paymentMethod: pick(["CASH", "CARD", "CASH", "CARD", "MIXED"]),
        branchId: branch.id,
        employeeId: employee.id,
        customerId: withCustomer ? pick(customers).id : null,
        createdAt,
      });
    }
  }

  await db.sale.createMany({ data: sales });
  await db.saleItem.createMany({ data: saleItems });
  console.log(`   ${sales.length} ta savdo, ${saleItems.length} ta pozitsiya`);

  // ─── Davomat (bugungi kun) ───
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const attData = [
    { emp: employees[0], checkInH: 8, checkInM: 58, late: 0, status: "PRESENT" as const },
    { emp: employees[1], checkInH: 9, checkInM: 3, late: 3, status: "LATE" as const },
    { emp: employees[2], checkInH: 9, checkInM: 18, late: 18, status: "LATE" as const },
  ];
  for (const a of attData) {
    const checkIn = new Date(today);
    checkIn.setHours(a.checkInH, a.checkInM, 0, 0);
    await db.attendance.create({
      data: {
        employeeId: a.emp.id,
        date: today,
        checkIn,
        lateMinutes: a.late,
        penalty: a.late <= 5 ? 0 : a.late <= 15 ? 2 : a.late <= 60 ? 5 : 10,
        status: a.status,
      },
    });
  }
  // Bobur — ta'tilda
  await db.attendance.create({
    data: { employeeId: employees[3].id, date: today, status: "ON_LEAVE" },
  });

  // ─── KPI (joriy oy) ───
  const kpiComponents = [
    { emp: employees[0], salesScore: 96, marginScore: 91, attendanceScore: 100, disciplineScore: 88, customerScore: 91 },
    { emp: employees[1], salesScore: 92, marginScore: 88, attendanceScore: 98, disciplineScore: 90, customerScore: 84 },
    { emp: employees[2], salesScore: 90, marginScore: 85, attendanceScore: 94, disciplineScore: 86, customerScore: 82 },
    { emp: employees[3], salesScore: 74, marginScore: 70, attendanceScore: 80, disciplineScore: 60, customerScore: 68 },
  ];
  for (const k of kpiComponents) {
    const totalScore = computeTotalScore(k);
    const bonusPercent = bonusPercentForScore(totalScore);
    await db.kpiRecord.create({
      data: {
        employeeId: k.emp.id,
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        salesScore: k.salesScore,
        marginScore: k.marginScore,
        attendanceScore: k.attendanceScore,
        disciplineScore: k.disciplineScore,
        customerScore: k.customerScore,
        totalScore,
        bonusPercent,
        bonusAmount: Math.round((Number(k.emp.baseSalary) * bonusPercent) / 100),
      },
    });
  }

  console.log("✅ Seed tugadi!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
