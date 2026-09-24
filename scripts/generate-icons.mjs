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

/** Dorixona belgisi: yashil fon, shaffof kapsula va yurak urishi chizig'i */
function icon({ padding = 0 } = {}) {
  const s = 512;
  const inset = padding;
  const box = s - inset * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2ec27e"/>
      <stop offset="55%" stop-color="#1a9463"/>
      <stop offset="100%" stop-color="#127048"/>
    </linearGradient>
    <radialGradient id="glow" cx="30%" cy="22%" r="45%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="shade" cx="78%" cy="82%" r="40%">
      <stop offset="0%" stop-color="#05301f" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#05301f" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${s}" height="${s}" fill="url(#bg)"/>
  <rect width="${s}" height="${s}" fill="url(#glow)"/>
  <rect width="${s}" height="${s}" fill="url(#shade)"/>

  <g transform="translate(${inset} ${inset}) scale(${box / s})">
    <g transform="rotate(-38 256 256)">
      <rect x="96" y="186" width="320" height="140" rx="70"
            fill="#ffffff" fill-opacity="0.2" stroke="#ffffff" stroke-opacity="0.45" stroke-width="6"/>
      <line x1="256" y1="186" x2="256" y2="326" stroke="#ffffff" stroke-opacity="0.45" stroke-width="6"/>
    </g>
    <polyline points="112,262 176,262 208,196 252,320 288,242 330,242 356,208 400,262"
              fill="none" stroke="#ffffff" stroke-width="26"
              stroke-linecap="round" stroke-linejoin="round"/>
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
