"use client";

import { useEffect, useRef } from "react";

/** Shuncha vaqt hech narsa bosilmasa, foydalanuvchi "joyida yo'q" deb hisoblanadi */
const IDLE_AFTER_MS = 2 * 60 * 1000;
/** "Joyida yo'q" bo'lgandan keyin shuncha vaqt o'tsa, parol qayta so'raladi */
const LOCK_AFTER_MS = 30 * 60 * 1000;

const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"] as const;

function readStored(key: string) {
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function writeStored(key: string, value: number) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // saqlanmasa ham shu oynaning o'zida hisob davom etadi
  }
}

/** Yangi kirishdan keyin hisobni noldan boshlash uchun */
export function markActivity(storageKey: string) {
  writeStored(storageKey, Date.now());
}

/**
 * Harakatsizlik qulfi: ishlab turgan odam chiqarib yuborilmaydi.
 *
 * 2 daqiqa hech narsa bosilmasa, o'sha paytdan 30 daqiqa sanaladi — shu
 * orada ham harakat bo'lmasa, onLock chaqiriladi. Oxirgi harakat vaqti
 * localStorage'da turadi: boshqa oynadagi ish ham hisoblanadi, ilova
 * yopilib uzoq vaqtdan keyin ochilsa esa darhol parol so'raladi.
 * notBefore — kirish vaqti: undan eski harakat hisobga olinmaydi.
 */
export function useIdleLock({
  storageKey,
  enabled = true,
  notBefore = 0,
  onLock,
}: {
  storageKey: string;
  enabled?: boolean;
  notBefore?: number;
  onLock: () => void;
}) {
  const onLockRef = useRef(onLock);
  onLockRef.current = onLock;

  useEffect(() => {
    if (!enabled) return;

    let last = Math.max(readStored(storageKey), notBefore) || Date.now();
    let lastWrite = 0;
    let locked = false;

    const lastActivity = () => Math.max(last, readStored(storageKey));

    const check = () => {
      if (locked) return;
      if (Date.now() - lastActivity() < IDLE_AFTER_MS + LOCK_AFTER_MS) return;
      locked = true;
      onLockRef.current();
    };

    const onActivity = () => {
      if (locked) return;
      // Ilova uzoq fonda turgan bo'lsa, birinchi teginish qulfni ochib yubormasin
      if (Date.now() - last >= IDLE_AFTER_MS + LOCK_AFTER_MS) check();
      if (locked) return;
      last = Date.now();
      if (last - lastWrite > 5000) {
        lastWrite = last;
        writeStored(storageKey, last);
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };

    writeStored(storageKey, last);
    check();
    const timer = window.setInterval(check, 15_000);
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true, capture: true });
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);

    return () => {
      window.clearInterval(timer);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity, { capture: true });
      }
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, [storageKey, enabled, notBefore]);
}
