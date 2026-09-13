import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { createMiniSession } from "@/lib/mini-session";
import { readUserAccess } from "@/lib/permission-db";
import { verifyTelegramSignature } from "@/lib/telegram-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  // Mini App ichidan kelsa, xodim Telegram'ini akkauntga bog'lash uchun
  initData: z.string().optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Email yoki parol noto'g'ri" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !user.isActive) {
    return Response.json({ ok: false, error: "Email yoki parol noto'g'ri" }, { status: 401 });
  }

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) {
    return Response.json({ ok: false, error: "Email yoki parol noto'g'ri" }, { status: 401 });
  }

  // Mini App ichidan (Telegram) kirilsa — bu xodimning Telegram'ini
  // akkauntга bog'laymiz. Shundan keyin bot uni xodim deb taniydi va
  // panel tugmasini ko'rsatadi (mijozlar bog'lanmaganligi uchun ko'rmaydi).
  if (parsed.data.initData) {
    const tg = verifyTelegramSignature(parsed.data.initData);
    if (tg.ok) {
      try {
        const tgId = BigInt(tg.user.id);
        // Bu Telegram boshqa akkauntga bog'langan bo'lsa, uni uzamiz
        await db.user.updateMany({
          where: { telegramId: tgId, NOT: { id: user.id } },
          data: { telegramId: null },
        });
        if (user.telegramId !== tgId) {
          await db.user.update({ where: { id: user.id }, data: { telegramId: tgId } });
        }
      } catch {
        // bog'lash muvaffaqiyatsiz bo'lsa ham login davom etadi
      }
    }
  }

  const access = await readUserAccess(user.id, user.role);
  return Response.json({
    ok: true,
    token: createMiniSession(user.id),
    user: {
      name: user.fullName,
      role: user.role,
      permissions: access.permissions,
      editPermissions: access.editPermissions,
    },
  });
}
