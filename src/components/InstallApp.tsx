"use client";

import { useEffect, useState } from "react";

/**
 * "Ilovani o'rnatish" tugmasi.
 *
 * Android, Windows va macOS (Chrome/Edge) brauzerlari o'rnatishni o'zlari
 * taklif qiladi — shu hodisani ushlab, tugmani ko'rsatamiz.
 * iPhone va iPad'da bunday hodisa yo'q, shuning uchun qo'llanma chiqadi.
 * Ilova allaqachon o'rnatilgan bo'lsa, tugma umuman ko'rinmaydi.
 */

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone === true;
}

function isApple() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());

    // Service worker — o'rnatish imkoniyati shu bilan ochiladi
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Ro'yxatdan o'tmasa ham sayt ishlayveradi
      });
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;
  // Brauzer taklif qilmayapti va Apple qurilmasi ham emas — tugma keraksiz
  if (!prompt && !isApple()) return null;

  async function install() {
    if (!prompt) {
      setShowHelp(true);
      return;
    }
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPrompt(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={install}
        className="rounded-lg border border-primary px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary-light"
      >
        Ilovani o&apos;rnatish
      </button>

      {showHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowHelp(false)}
        >
          <div className="card max-w-sm p-4 text-sm" onClick={(event) => event.stopPropagation()}>
            <h3 className="mb-2 text-base font-semibold">iPhone yoki iPad&apos;ga o&apos;rnatish</h3>
            <ol className="mb-3 list-decimal space-y-1 pl-5 text-muted">
              <li>Pastdagi &laquo;Ulashish&raquo; tugmasini bosing (yuqoriga strelka)</li>
              <li>Ro&apos;yxatdan &laquo;Bosh ekranga qo&apos;shish&raquo; ni tanlang</li>
              <li>&laquo;Qo&apos;shish&raquo; ni bosing</li>
            </ol>
            <p className="mb-3 text-xs text-muted">
              Shundan keyin Dorixona bosh ekranda oddiy ilova kabi turadi.
            </p>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-white"
            >
              Tushunarli
            </button>
          </div>
        </div>
      )}
    </>
  );
}
