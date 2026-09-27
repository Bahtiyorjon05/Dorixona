import "server-only";
import { db } from "@/lib/db";

/**
 * Qarz summalarini tarixdan qayta hisoblaydi va yopilganini belgilaydi.
 *
 * Sayt ham, Telegram Mini App ham shu funksiyani chaqiradi — qoldiq bir
 * joyda hisoblansin.
 */
export async function recalcDebt(debtId: string) {
  const entries = await db.debtEntry.findMany({
    where: { debtId },
    select: { type: true, amount: true },
  });

  let total = 0;
  let paid = 0;
  for (const entry of entries) {
    if (entry.type === "CHARGE") total += Number(entry.amount);
    else paid += Number(entry.amount);
  }

  const current = await db.debt.findUnique({ where: { id: debtId }, select: { closedAt: true } });
  const remaining = total - paid;
  // Qoldiq nolga tushsa yopiladi; yana qarz olinsa qayta ochiladi
  const closedAt = remaining <= 0.009 ? (current?.closedAt ?? new Date()) : null;

  await db.debt.update({
    where: { id: debtId },
    data: { totalAmount: total, paidAmount: paid, closedAt },
  });
  return { total, paid, remaining };
}
