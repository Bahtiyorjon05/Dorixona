"use client";

import dynamic from "next/dynamic";

// Recharts og'ir (~150kB) — sahifa ochilishini tezlashtirish uchun
// grafiklarni faqat kerak bo'lganda yuklaymiz (code-splitting).
const Skeleton = () => (
  <div className="h-[200px] w-full animate-pulse rounded-lg bg-surface" />
);

export const SalesBarChart = dynamic(
  () => import("./charts").then((m) => m.SalesBarChart),
  { ssr: false, loading: Skeleton },
);
export const CategoryDonut = dynamic(
  () => import("./charts").then((m) => m.CategoryDonut),
  { ssr: false, loading: Skeleton },
);
export const ProfitLineChart = dynamic(
  () => import("./charts").then((m) => m.ProfitLineChart),
  { ssr: false, loading: Skeleton },
);
export const CorrelationBarChart = dynamic(
  () => import("./charts").then((m) => m.CorrelationBarChart),
  { ssr: false, loading: Skeleton },
);
