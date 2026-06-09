"use client";

import { useActionState } from "react";
import { authenticate } from "@/lib/actions/auth";

export default function LoginPage() {
  const [errorMessage, formAction, isPending] = useActionState(
    authenticate,
    undefined,
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="card w-full max-w-sm p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light text-2xl">
            💊
          </div>
          <h1 className="text-lg font-semibold text-primary">Dorixona</h1>
          <p className="mt-1 text-sm text-muted">Boshqaruv paneliga kirish</p>
        </div>

        <form action={formAction} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              defaultValue="admin@dorixona.uz"
              className="w-full rounded-lg border border-edge bg-card px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="email@dorixona.uz"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="password">
              Parol
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              defaultValue="admin123"
              className="w-full rounded-lg border border-edge bg-card px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="••••••••"
            />
          </div>

          {errorMessage && (
            <p className="rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {isPending ? "Kirilmoqda..." : "Kirish"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted">
          Test: admin@dorixona.uz / admin123
        </p>
      </div>
    </div>
  );
}
