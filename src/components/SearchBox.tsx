"use client";

/**
 * Ro'yxatlar ustidagi qidiruv maydoni.
 *
 * Hamma bo'limda bir xil ko'rinish va bir xil xulq: chapda lupa, yozilgach
 * o'ngda tozalash tugmasi. Filtrlashni chaqiruvchi o'zi qiladi — bu yerda
 * faqat ko'rinish.
 */
export function SearchBox({
  value,
  onChange,
  placeholder = "Qidirish...",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
      >
        <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M13.5 13.5 17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>

      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-edge bg-card py-1.5 pl-8 pr-8 text-sm outline-none focus:border-primary"
      />

      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Tozalash"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-1 text-muted transition hover:text-fg"
        >
          ×
        </button>
      )}
    </div>
  );
}

/** Qidiruv uchun matnni solishtirishga tayyorlaydi */
export function searchKey(value: string | null | undefined) {
  return (value ?? "").toLowerCase().trim();
}

/** Qatorning biror maydoni qidiruvga mos keladimi */
export function matchesSearch(query: string, ...fields: (string | null | undefined)[]) {
  const q = searchKey(query);
  if (!q) return true;
  return fields.some((field) => searchKey(field).includes(q));
}
