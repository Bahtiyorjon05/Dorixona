"use client";

import { useIdleLock } from "@/lib/idle-lock";
import { lockApp } from "@/lib/actions/auth";

/**
 * Sayt va o'rnatilgan ilovada harakatsizlik qulfi: 2 daqiqa hech narsa
 * bosilmasa, undan keyin 30 daqiqa o'tganda login va parol so'raladi.
 */
export function AppLock({ loginAt }: { loginAt: number | null }) {
  useIdleLock({
    storageKey: "dorixonaLastActivity",
    notBefore: loginAt,
    onLock: () => void lockApp(),
  });
  return null;
}
