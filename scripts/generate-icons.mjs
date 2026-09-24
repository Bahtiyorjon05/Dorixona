/**
 * Ilova ikonkalarini yasaydi (PWA uchun).
 * Ishga tushirish: node scripts/generate-icons.mjs
 *
 * Bitta SVG dan barcha o'lchamlar chiqariladi, shuning uchun dizayn
 * o'zgarsa faqat shu fayldagi SVG tahrirlanadi.
 */
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const GREEN = "#1a7f5a";
const LIGHT = "#e8f5f0";

/**
 * Evomed apteka ilova ikonkasi: ko'k fon, brend yuragi va oq kapsula.
 * Brend ranglari logotipdagidek — pushti #ec1e79, ko'k #1b2f8f.
 */
function icon({ padding = 0 } = {}) {
  const s = 512;
  const inset = padding;
  const box = s - inset * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2a45c4"/>
      <stop offset="55%" stop-color="#1b2f8f"/>
      <stop offset="100%" stop-color="#121f63"/>
    </linearGradient>
    <radialGradient id="glow" cx="28%" cy="20%" r="48%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${s}" height="${s}" fill="url(#bg)"/>
  <rect width="${s}" height="${s}" fill="url(#glow)"/>

  <g transform="translate(${inset} ${inset}) scale(${box / s})">
    <!-- Brend yuragi -->
    <path d="M256 412l-22-20c-78-70-129-116-129-174 0-47 37-84 84-84 27 0 52 12 67 32
             15-20 40-32 67-32 47 0 84 37 84 84 0 58-51 104-129 174z" fill="#ec1e79"/>
    <!-- Yurak ichidagi oq kapsula -->
    <g transform="rotate(-38 256 232)">
      <rect x="150" y="196" width="212" height="86" rx="43" fill="#ffffff"/>
      <line x1="256" y1="196" x2="256" y2="282" stroke="#ec1e79" stroke-opacity="0.35" stroke-width="7"/>
    </g>
  </g>
</svg>`;
}

const targets = [
  { file: "icon-192.png", size: 192, padding: 0 },
  { file: "icon-512.png", size: 512, padding: 0 },
  // Maskable: Android ikonkani qirqadi, shuning uchun chetida bo'sh joy qoladi
  { file: "icon-maskable-512.png", size: 512, padding: 96 },
  { file: "apple-touch-icon.png", size: 180, padding: 24 },
  { file: "favicon-32.png", size: 32, padding: 0 },
];

await mkdir("public/icons", { recursive: true });
for (const target of targets) {
  const svg = Buffer.from(icon({ padding: target.padding }));
  await sharp(svg).resize(target.size, target.size).png().toFile(`public/icons/${target.file}`);
  console.log("yasaldi:", target.file);
}

await writeFile("public/icons/icon.svg", icon());
console.log("yasaldi: icon.svg");
