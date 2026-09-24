"use client";

import { useEffect, useState } from "react";

/**
 * Yangi versiya chiqqanini bildiradi.
 *
 * Ilova ochiq turganda sahifa o'zi yangilanmaydi — sayt yangilansa ham
 * eski ko'rinish qolaveradi. Shuning uchun har soatda tekshiramiz va
 * yangisi tayyor bo'lsa pastda kichik xabar chiqaramiz. Qachon yangilashni
 * foydalanuvchi hal qiladi: ish o'rtasida sahifa o'zi qayta yuklanmaydi.
 */
export function AppUpdate() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let registration: ServiceWorkerRegistration | null = null;

    const onUpdateFound = () => {
      const installing = registration?.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        // Yangi versiya o'rnatildi va eskisi hali ishlayapti
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          setReady(true);
        }
      });
    };

    navigator.serviceWorker.ready.then((reg) => {
      registration = reg;
      reg.addEventListener("updatefound", onUpdateFound);
      // Har soatda va sahifaga qaytilganda tekshiriladi
      const timer = setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
      const onVisible = () => {
        if (document.visibilityState === "visible") reg.update().catch(() => {});
      };
      document.addEventListener("visibilitychange", onVisible);
      return () => {
        clearInterval(timer);
        document.removeEventListener("visibilitychange", onVisible);
      };
    });
  }, []);

  if (!ready) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <div className="card flex items-center gap-3 px-4 py-2.5 text-sm shadow-lg">
        <span>Yangi versiya tayyor</span>
        <button type="button" onClick={() => window.location.reload()} className="btn btn-primary btn-sm">
          Yangilash
        </button>
      </div>
    </div>
  );
}
