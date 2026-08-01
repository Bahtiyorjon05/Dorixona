import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { syncFapteka } from "@/lib/integrations/fapteka/sync";
import { canAccessPermission } from "@/lib/permissions";

const syncSchema = z.object({
  mode: z.enum(["catalog", "movements", "sales", "all"]).default("all"),
  dateFrom: z.string().min(8),
  dateTo: z.string().min(8),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Avtorizatsiya talab qilinadi" }, { status: 401 });
  }
  if (!canAccessPermission(session.user.role, session.user.permissions, "sozlamalar")) {
    return NextResponse.json({ ok: false, error: "Ruxsat yo'q" }, { status: 403 });
  }

  const body = syncSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ ok: false, error: "So'rov formati noto'g'ri" }, { status: 400 });
  }

  const summary = await syncFapteka(body.data);
  return NextResponse.json(summary, { status: summary.ok ? 200 : 207 });
}
