"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

/**
 * Kirish tugmasi: Enter bilan ham ishlaydi va kutish paytida ko'rinadi.
 *
 * Parol tekshiruvi bir-ikki soniya oladi. Oldin shu vaqtda ekranda hech
 * narsa o'zgarmasdi va Enter ishlamagandek tuyulardi.
 */
export function LoginSubmit() {
  const { pending } = useFormStatus();
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.isComposing) return;
      event.preventDefault();
      form.requestSubmit(ref.current);
    };
    form.addEventListener("keydown", onKeyDown);
    return () => form.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <button
      ref={ref}
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Kirilmoqda..." : "Kirish"}
    </button>
  );
}
