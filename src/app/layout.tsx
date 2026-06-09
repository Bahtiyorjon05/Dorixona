import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Dorixona — boshqaruv platformasi",
  description:
    "Dorixona moliya, ombor, xodimlar KPI va sodiqlik tizimi boshqaruv paneli",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uz" className={`${inter.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
