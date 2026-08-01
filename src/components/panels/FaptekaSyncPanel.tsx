"use client";

import { useActionState } from "react";
import { runFaptekaSync, type FaptekaSyncActionState } from "@/lib/actions/settings";

const initialState: FaptekaSyncActionState = { ok: true, message: "" };

export function FaptekaSyncPanel({
  defaultDateFrom,
  defaultDateTo,
  reportConfigured,
}: {
  defaultDateFrom: string;
  defaultDateTo: string;
  reportConfigured: boolean;
}) {
  const [state, formAction, pending] = useActionState(runFaptekaSync, initialState);
  const summary = state.summary;

  return (
    <form action={formAction} className="space-y-3">
      {!reportConfigured && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Bu tugma faqat REPORT.exe orqali qo'lda tortish uchun. SITE.exe esa avtomatik push qiladi.
          REPORT sync ishlashi uchun FAPTEKA_REPORT_BASE_URL yoki FAPTEKA_REPORT_URL kerak.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-[1fr_150px_150px_auto]">
        <label className="text-xs font-medium text-muted">
          REPORT sync turi
          <select
            name="mode"
            defaultValue="all"
            className="mt-1 w-full rounded-lg border border-edge bg-card px-3 py-2 text-sm text-fg outline-none focus:border-primary"
          >
            <option value="all">Hammasi</option>
            <option value="catalog">Mahsulot + qoldiq</option>
            <option value="sales">Savdo</option>
            <option value="movements">Kirim/qaytarish/spisanie</option>
          </select>
        </label>
        <label className="text-xs font-medium text-muted">
          Boshlanish
          <input
            name="dateFrom"
            type="date"
            defaultValue={defaultDateFrom}
            className="mt-1 w-full rounded-lg border border-edge bg-card px-3 py-2 text-sm text-fg outline-none focus:border-primary"
          />
        </label>
        <label className="text-xs font-medium text-muted">
          Tugash
          <input
            name="dateTo"
            type="date"
            defaultValue={defaultDateTo}
            className="mt-1 w-full rounded-lg border border-edge bg-card px-3 py-2 text-sm text-fg outline-none focus:border-primary"
          />
        </label>
        <button
          type="submit"
          disabled={pending || !reportConfigured}
          className="self-end rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Sync..." : "REPORT sync"}
        </button>
      </div>

      {state.message && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            state.ok
              ? "border-primary/30 bg-primary-light text-primary"
              : "border-danger/30 bg-danger-light text-danger"
          }`}
        >
          {state.message}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
          <div className="rounded-lg bg-surface p-2">
            <div className="text-muted">Mahsulot/qoldiq</div>
            <div className="font-semibold">{summary.productsUpserted} ta</div>
          </div>
          <div className="rounded-lg bg-surface p-2">
            <div className="text-muted">Harakatlar</div>
            <div className="font-semibold">{summary.movementsCreated} ta</div>
          </div>
          <div className="rounded-lg bg-surface p-2">
            <div className="text-muted">Xarajatlar</div>
            <div className="font-semibold">{summary.expensesCreated} ta</div>
          </div>
          <div className="rounded-lg bg-surface p-2">
            <div className="text-muted">Savdolar</div>
            <div className="font-semibold">{summary.salesUpserted} ta</div>
          </div>
          <div className="rounded-lg bg-surface p-2">
            <div className="text-muted">O'qilgan qator</div>
            <div className="font-semibold">
              {summary.catalogRows + summary.stockRows + summary.movementRows + summary.saleRows}
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
