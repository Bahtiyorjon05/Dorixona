import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { db } from "@/lib/db";
import { readUserAccess } from "@/lib/permission-db";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      authorize: async (credentials) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await db.user.findUnique({ where: { email } });
        if (!user || !user.isActive) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        const access = await readUserAccess(user.id, user.role);

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          role: user.role,
          branchId: user.branchId,
          permissions: access.permissions,
          editPermissions: access.editPermissions,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.branchId = user.branchId;
        token.permissions = user.permissions;
        token.editPermissions = user.editPermissions;
      }
      return token;
    },
    session({ session, token }) {
      if (token.role) session.user.role = token.role as typeof session.user.role;
      if (token.branchId) session.user.branchId = token.branchId as string;
      session.user.permissions = Array.isArray(token.permissions)
        ? token.permissions.filter((permission): permission is string => typeof permission === "string")
        : [];
      session.user.editPermissions = Array.isArray(token.editPermissions)
        ? token.editPermissions.filter((permission): permission is string => typeof permission === "string")
        : [];
      return session;
    },
  },
});
