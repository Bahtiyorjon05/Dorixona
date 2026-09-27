import type { Role } from "@/generated/prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role?: Role;
    branchId?: string | null;
    permissions?: string[];
    editPermissions?: string[];
  }
  interface Session {
    user: {
      role?: Role;
      branchId?: string | null;
      permissions?: string[];
      editPermissions?: string[];
      /** Parol kiritilgan vaqt (ms) — ilovada 15 daqiqalik qulf shundan hisoblanadi */
      loginAt?: number;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    branchId?: string | null;
    permissions?: string[];
    editPermissions?: string[];
    loginAt?: number;
  }
}
