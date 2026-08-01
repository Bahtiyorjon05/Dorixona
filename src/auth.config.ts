import type { NextAuthConfig } from "next-auth";
import { firstAllowedPath, permissionForPath, canAccessPermission } from "@/lib/permissions";

// Edge-safe konfiguratsiya (middleware shu yerdan foydalanadi — DB yo'q)
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
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
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith("/login");

      if (isOnLogin) {
        if (isLoggedIn) {
          const allowedPath = firstAllowedPath(auth?.user?.role, auth?.user?.permissions);
          if (allowedPath !== "/login") {
            return Response.redirect(new URL(allowedPath, nextUrl));
          }
        }
        return true;
      }
      if (!isLoggedIn) return false;

      const permission = permissionForPath(nextUrl.pathname);
      if (permission && !canAccessPermission(auth.user?.role, auth.user?.permissions, permission)) {
        const allowedPath = firstAllowedPath(auth.user?.role, auth.user?.permissions);
        return Response.redirect(new URL(allowedPath, nextUrl));
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
