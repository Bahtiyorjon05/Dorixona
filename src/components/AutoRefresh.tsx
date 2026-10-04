"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Sahifani har N soniyada serverdan yangilaydi (jonli ko'rinish uchun) */
export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => window.clearInterval(timer);
  }, [router, seconds]);
  return null;
}
