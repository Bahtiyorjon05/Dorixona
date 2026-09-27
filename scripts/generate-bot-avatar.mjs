/**
 * Telegram bot uchun rasmlar.
 * Ishga tushirish: node scripts/generate-bot-avatar.mjs
 *
 * Ikkitasi chiqadi:
 *   bot-avatar.png (512x512) — bot profili surati
 *   bot-cover.png  (640x360) — bo'sh suhbatda /start dan oldin ko'rinadigan rasm
 *
 * Nega ilova ikonkasidan alohida: Telegram profil suratini DOIRA qilib
 * qirqadi, shuning uchun yurakning uchi kesilib qolmasin deb belgi
 * kichikroq va markazga yaqinroq qo'yilgan.
 */
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const PINK = "#ec1e79";
const NAVY_1 = "#2a45c4";
const NAVY_2 = "#1b2f8f";
const NAVY_3 = "#121f63";

/** Brend belgisi: pushti yurak va ichidagi oq kapsula (512 lik koordinatada) */
function mark() {
  return `
    <path d="M256 412l-22-20c-78-70-129-116-129-174 0-47 37-84 84-84 27 0 52 12 67 32
             15-20 40-32 67-32 47 0 84 37 84 84 0 58-51 104-129 174z" fill="${PINK}"/>
    <g transform="rotate(-38 256 232)">
      <rect x="150" y="196" width="212" height="86" rx="43" fill="#ffffff"/>
      <line x1="256" y1="196" x2="256" y2="282" stroke="${PINK}" stroke-opacity="0.35" stroke-width="7"/>
    </g>`;
}

function background(width, height, id = "bg") {
  return `
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${NAVY_1}"/>
        <stop offset="55%" stop-color="${NAVY_2}"/>
        <stop offset="100%" stop-color="${NAVY_3}"/>
      </linearGradient>
      <radialGradient id="${id}-glow" cx="28%" cy="20%" r="48%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.2"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#${id})"/>
    <rect width="${width}" height="${height}" fill="url(#${id}-glow)"/>`;
}

/**
 * Profil surati. Belgi 0.78 ga kichraytirilib markazga suriladi —
 * doira qirqimida yurakning uchi ham, yon qirralari ham ichkarida qoladi.
 */
function avatarSvg() {
  const s = 512;
  const scale = 0.78;
  const shift = (s - s * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  ${background(s, s)}
  <g transform="translate(${shift} ${shift + 8}) scale(${scale})">${mark()}</g>
</svg>`;
}

/**
 * Bo'sh suhbat rasmi: belgi + nom + bir qatorli izoh.
 *
 * Buni birinchi bo'lib MIJOZ ko'radi (/start bosishdan oldin), shuning
 * uchun yozuv mijozga qaratilgan — xodimlar paneli haqida emas.
 */
function coverSvg() {
  const w = 640;
  const h = 360;
  const markScale = 0.42;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${background(w, h, "cover")}
  <g transform="translate(56 ${(h - 512 * markScale) / 2}) scale(${markScale})">${mark()}</g>
  <g font-family="Helvetica Neue, Helvetica, Arial, sans-serif" fill="#ffffff">
    <text x="300" y="158" font-size="46" font-weight="700" letter-spacing="-0.5">Evomed</text>
    <text x="300" y="212" font-size="46" font-weight="700" letter-spacing="-0.5">apteka</text>
    <text x="300" y="256" font-size="20" fill="#b9c4f2">Bonus karta va chegirmalar</text>
  </g>
</svg>`;
}

const targets = [
  { file: "bot-avatar.png", svg: avatarSvg(), size: 512 },
  { file: "bot-cover.png", svg: coverSvg(), size: null },
];

await mkdir("public/icons", { recursive: true });

for (const target of targets) {
  const image = sharp(Buffer.from(target.svg));
  const png = await (target.size ? image.resize(target.size, target.size) : image).png().toBuffer();
  await writeFile(`public/icons/${target.file}`, png);
  console.log(`${target.file} — ${(png.length / 1024).toFixed(1)} KB`);
}
