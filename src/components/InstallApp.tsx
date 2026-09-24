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

const STEPS: Record<Platform, { title: string; steps: string[]; note?: string }> = {
  ios: {
    title: "iPhone yoki iPad'ga o'rnatish",
    steps: [
      "Sahifa Safari'da ochilgan bo'lsin (Chrome'da ishlamaydi)",
      "Pastdagi «Ulashish» tugmasini bosing — yuqoriga qaragan strelka",
      "Ro'yxatdan «Bosh ekranga qo'shish» ni tanlang",
      "O'ng yuqoridagi «Qo'shish» ni bosing",
    ],
  },
  "safari-mac": {
    title: "Mac'da Safari orqali o'rnatish",
    steps: [
      "Yuqoridagi menyudan «Файл» (File) ni oching",
      "«Add to Dock…» / «Dock'ga qo'shish» ni tanlang",
      "Nomini tasdiqlang — «Add» ni bosing",
    ],
    note: "Chrome yoki Edge'da ochsangiz, bir bosishda o'rnatiladi.",
  },
  firefox: {
    title: "Firefox o'rnatishni qo'llab-quvvatlamaydi",
    steps: [
      "Saytni Chrome, Edge yoki Safari'da oching",
      "O'sha yerda «Ilovani o'rnatish» tugmasini bosing",
    ],
  },
  other: {
    title: "Ilovani o'rnatish",
    steps: [
      "Manzil satrining o'ng chetidagi o'rnatish belgisini bosing",
      "Yoki brauzer menyusidan «Ilovani o'rnatish» ni tanlang",
    ],
    note: "Belgi ko'rinmasa, sahifani yangilab ko'ring.",
  },
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
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden) return null;

  async function install() {
    if (!prompt) {
      setShowHelp(true);
      return;
    }
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") setHidden(true);
    setPrompt(null);
  }

  const help = STEPS[platform];

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
            <h3 className="mb-2 text-base font-semibold">{help.title}</h3>
            <ol className="mb-3 list-decimal space-y-1 pl-5 text-muted">
              {help.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {help.note && <p className="mb-3 text-xs text-muted">{help.note}</p>}
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
