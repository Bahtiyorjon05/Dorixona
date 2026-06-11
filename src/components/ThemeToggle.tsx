"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  }

  return (
    <button
      onClick={toggle}
      aria-label="Temani almashtirish"
      title={dark ? "Yorug' rejim" : "Qorong'i rejim"}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-edge text-sm transition hover:bg-surface"
    >
      {mounted ? (dark ? "☀️" : "🌙") : "🌓"}
    </button>
  );
}
