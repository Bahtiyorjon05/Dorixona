import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dorixona kompyuteri uchun ko'prik skriptlari — GitHub o'rniga shu yerdan.
 *
 *   /api/integrations/fapteka/skript/install-tasks.ps1?token=<FAPTEKA_SITE_TOKEN>
 *
 * Repo yopiq (private): raw.githubusercontent.com dan yuklab bo'lmaydi.
 * Skriptlarda parol yo'q (u kompyuterdagi sql.txt / token.txt da), lekin
 * baribir faqat token bilan beriladi. Fayllar build'ga next.config dagi
 * outputFileTracingIncludes orqali qo'shiladi.
 */

const ALLOWED = new Set(["fapteka-relay.ps1", "site-watchdog.ps1", "install-tasks.ps1", "fapteka-scan.ps1"]);

function allowed(request: NextRequest) {
  const expected = [process.env.FAPTEKA_SITE_TOKEN?.trim(), process.env.CRON_SECRET?.trim()].filter(Boolean);
  const auth = request.headers.get("authorization")?.trim() ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const token = bearer || request.nextUrl.searchParams.get("token")?.trim() || "";
  return token !== "" && expected.includes(token);
}

/**
 * Xato javoblar ham keshlanmasin.
 *
 * Deploy'dan oldin bu manzil Next.js ning 404 sahifasini qaytargan va
 * Vercel o'shani keshlab qolgan: endpoint chiqqandan keyin ham eski 404
 * berilaverdi, skript o'rniga HTML yuklandi. no-store shuni qaytarmaydi.
 */
const noStore = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  if (!allowed(request)) {
    return NextResponse.json({ ok: false, error: "Token noto'g'ri" }, { status: 401, headers: noStore });
  }
  const { name } = await params;
  if (!ALLOWED.has(name)) {
    return NextResponse.json({ ok: false, error: "Bunday skript yo'q" }, { status: 404, headers: noStore });
  }
  try {
    const text = await readFile(path.join(process.cwd(), "scripts", "fapteka-relay", name), "utf8");
    return new NextResponse(text, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Skript build'ga kirmagan" }, { status: 500, headers: noStore });
  }
}
