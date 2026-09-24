/**
 * Evomed apteka logotipi.
 *
 * Brend ranglari: "Evo" pushti, "med" ko'k, yonida pushti yurak.
 * Klinikaning logotipidan farqi — pastida "apteka" yozuvi.
 * Matn SVG ichida chizilgan, shuning uchun qorong'i temada ham o'zgarmaydi.
 */
export function Logo({ height = 28 }: { height?: number }) {
  return (
    <svg
      height={height}
      viewBox="0 0 260 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Evomed apteka"
    >
      <text
        x="0"
        y="38"
        fontFamily="var(--font-sans), system-ui, sans-serif"
        fontSize="36"
        fontWeight="800"
        letterSpacing="-0.5"
      >
        <tspan fill="#ec1e79">Evo</tspan>
        <tspan fill="#1b2f8f">med</tspan>
      </text>
      <text
        x="62"
        y="64"
        fontFamily="var(--font-sans), system-ui, sans-serif"
        fontSize="22"
        fontWeight="700"
        fill="#1b2f8f"
        letterSpacing="1"
      >
        apteka
      </text>
      {/* Brend yuragi — ikkita yoy bilan chizilgan */}
      <path
        d="M182 20c7-10 22-9 27 1 4 8 0 17-8 24l-19 17-19-17c-8-7-12-16-8-24 5-10 20-11 27-1z"
        fill="#ec1e79"
      />
      <path
        d="M182 33c4-6 13-5 16 1 2 5 0 10-5 14l-11 10-11-10c-5-4-7-9-5-14 3-6 12-7 16-1z"
        fill="#ffffff"
        fillOpacity="0.28"
      />
    </svg>
  );
}
