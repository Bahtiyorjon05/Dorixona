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

/** Dorixona belgisi: yumaloq yashil fon + oq kapsula */
function icon({ padding = 0 } = {}) {
  const s = 512;
  const inset = padding;
  const box = s - inset * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" fill="${GREEN}"/>
  <g transform="translate(${inset} ${inset}) scale(${box / s})">
    <g transform="rotate(-45 256 256)">
      <rect x="176" y="96" width="160" height="320" rx="80" fill="#ffffff"/>
      <path d="M176 256h160v80a80 80 0 0 1-80 80 80 80 0 0 1-80-80z" fill="${LIGHT}"/>
      <rect x="176" y="246" width="160" height="20" fill="${GREEN}" opacity="0.25"/>
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
