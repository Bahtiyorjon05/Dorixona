"use client";

import { useEffect, useState } from "react";

/**
 * "Ilovani o'rnatish" tugmasi.
 *
 * Chrome va Edge o'rnatishni o'zi taklif qiladi — o'sha hodisani ushlab,
 * bir bosishda o'rnatamiz. Safari va Firefox bunday imkon bermaydi,
 * shuning uchun tugma bosilganda o'sha brauzerga mos qo'llanma chiqadi.
 * Ilova allaqachon o'rnatilgan bo'lsa, tugma ko'rinmaydi.
 */

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Taklif sahifa ochilishida ushlanadi (layout.tsx) va shu yerda olinadi */
declare global {
  interface Window {
    __pwaPrompt?: InstallPrompt | null;
  }
}

type Platform = "ios" | "safari-mac" | "firefox" | "other";

function isStandalone() {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone === true;
}

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  // iPad'ning yangi versiyalari o'zini Mac deb ko'rsatadi
  if (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return "ios";
  if (/^((?!chrome|android|crios|edg).)*safari/i.test(ua)) return "safari-mac";
  if (/firefox|fxios/i.test(ua)) return "firefox";
  return "other";
}

/** Brauzer o'rnatishni taklif qilmasa — bitta qatorlik yo'l-yo'riq */
const HINT: Record<Platform, string> = {
  ios: "Safari'da: Ulashish → «Bosh ekranga qo'shish»",
  "safari-mac": "Safari'da: Файл → «Add to Dock». Chrome'da bir bosishda o'rnatiladi.",
  firefox: "Firefox o'rnatishni qo'llab-quvvatlamaydi — Chrome yoki Edge'da oching.",
  other: "Manzil satrining o'ng chetidagi o'rnatish belgisini bosing.",
};

export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [hidden, setHidden] = useState(true);
  const [platform, setPlatform] = useState<Platform>("other");
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    setHidden(isStandalone());
    setPlatform(detectPlatform());

    // Service worker — o'rnatish imkoniyati shu bilan ochiladi
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Ro'yxatdan o'tmasa ham sayt ishlayveradi
      });
    }

    // Sahifa boshida ushlab qo'yilgan taklif bo'lsa, darhol olamiz
    if (window.__pwaPrompt) setPrompt(window.__pwaPrompt);

    const onReady = () => {
      if (window.__pwaPrompt) setPrompt(window.__pwaPrompt);
    };
    window.addEventListener("pwa-prompt-ready", onReady);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => {
      setHidden(true);
      setPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("pwa-prompt-ready", onReady);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden) return null;

  async function install() {
    const ready = prompt ?? window.__pwaPrompt ?? null;
    if (!ready) {
      setShowHelp(true);
      return;
    }
    await ready.prompt();
    const choice = await ready.userChoice;
    if (choice.outcome === "accepted") setHidden(true);
    window.__pwaPrompt = null;
    setPrompt(null);
  }

  const hint = HINT[platform];

  return (
    <>
      <button
        type="button"
        onClick={install}
        className="btn btn-primary btn-sm whitespace-nowrap"
      >
        <span aria-hidden>⤓</span> Ilovani o&apos;rnatish
      </button>

      {showHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowHelp(false)}
        >
          <div className="card max-w-xs p-4 text-sm" onClick={(event) => event.stopPropagation()}>
            <p className="mb-3">{hint}</p>
            <button type="button" onClick={() => setShowHelp(false)} className="btn btn-primary w-full">
              Tushunarli
            </button>
          </div>
        </div>
      )}
    </>
  );
}
