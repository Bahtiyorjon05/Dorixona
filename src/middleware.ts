import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  /*
   * API, statik fayllar va rasm optimizatsiyasidan tashqari hamma yo'l.
   *
   * Ilova fayllari (manifest, service worker, ikonkalar) ham ochiq qoladi:
   * brauzer ularni tizimga kirmasdan o'qiydi. Ular yopilsa, "Ilovani
   * o'rnatish" umuman ishlamaydi — Chrome manifestni topolmay qoladi.
   */
  matcher: [
    "/((?!api|tg-admin|_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|sw.js|offline.html|.*\\.svg$|.*\\.png$).*)",
  ],
};
