import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Evomed apteka — boshqaruv platformasi",
  description:
    "Evomed apteka: savdo, ombor, moliya, qarzlar va xodimlar boshqaruvi",
  // Telefon va kompyuterga ilova sifatida o'rnatish uchun
  manifest: "/manifest.webmanifest",
  applicationName: "Evomed apteka",
  appleWebApp: { capable: true, title: "Evomed apteka", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1b2f8f",
};

/*
 * Chrome o'rnatish taklifini sahifa yuklanishining boshida beradi — React
 * komponenti ulgurmay qoladi va taklif yo'qoladi. Shuning uchun uni shu
 * yerda, eng boshida ushlab qo'yamiz; tugma keyin shu saqlangan taklifni
 * ishlatadi.
 */
const installScript = `(function(){window.__pwaPrompt=null;window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__pwaPrompt=e;window.dispatchEvent(new Event('pwa-prompt-ready'))});window.addEventListener('appinstalled',function(){window.__pwaPrompt=null})})()`;

// Sahifa ko'rinishidan oldin temani o'rnatadi (miltillashning oldini oladi)
const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uz" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: installScript }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
