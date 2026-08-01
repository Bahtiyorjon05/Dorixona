import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { createMiniSession } from "@/lib/mini-session";
import { readUserAccess } from "@/lib/permission-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
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
