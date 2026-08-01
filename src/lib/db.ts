import { PrismaClient } from "@/generated/prisma/client";
import { createPrismaPgAdapter } from "@/lib/postgres";

// Next.js dev rejimida hot-reload har safar yangi mijoz yaratmasligi uchun
// global'da saqlaymiz (best practice).
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  const adapter = createPrismaPgAdapter();
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
