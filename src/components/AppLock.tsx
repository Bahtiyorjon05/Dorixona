"use client";

import { useEffect } from "react";
import { lockApp } from "@/lib/actions/auth";

/** Ilovada parol shuncha vaqtdan keyin qayta so'raladi */
const LOCK_AFTER_MS = 15 * 60 * 1000;

function isStandalone() {
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone === true;
}

/**
 * O'rnatilgan ilovada har 15 daqiqada login va parol so'raladi.
 *
 * Telefon yoki kompyuterda ilova doim ochiq turadi, begona odam qo'liga
 * tushsa moliya raqamlari ko'rinib qolmasin. Vaqt parol kiritilgan
 * paytdan hisoblanadi. Ilova fonda turganda taymer to'xtab qoladi,
 * shuning uchun ilovaga qaytilganda ham vaqt qayta tekshiriladi.
 * Brauzerdagi oddiy sayt bunga kirmaydi.
 */
export function AppLock({ loginAt }: { loginAt: number | null }) {
  useEffect(() => {
    if (!isStandalone()) return;

    // Eski sessiyada kirish vaqti yo'q — bir marta qayta kirish kerak
    const deadline = (loginAt ?? 0) + LOCK_AFTER_MS;
    let locked = false;
    const check = () => {
      if (locked || Date.now() < deadline) return;
      locked = true;
      void lockApp();
    };

    check();
    const timer = window.setTimeout(check, Math.max(0, deadline - Date.now()) + 500);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, [loginAt]);

  return null;
}
