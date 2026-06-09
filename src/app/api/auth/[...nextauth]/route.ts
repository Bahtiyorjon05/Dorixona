import { handlers } from "@/auth";

export const runtime = "nodejs"; // Prisma pg adapter uchun

export const { GET, POST } = handlers;
