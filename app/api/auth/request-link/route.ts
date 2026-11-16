import { NextRequest, NextResponse } from "next/server";
import { users } from "@/lib/users";
import { createMagicLinkToken } from "@/lib/auth";
import { sendMagicLinkEmail } from "@/lib/email";
import { ipLimited, rateLimited, emailKey, TOO_MANY } from "@/lib/rateLimit";

// POST /api/auth/request-link { email } — pošle přihlašovací odkaz, pokud e-mail patří
// existujícímu účtu (admini jsou nasazeni automaticky, členy zakládá admin ručně).
// Odpověď je VŽDY stejná (ok), ať účet existuje, nebo ne: jinak by si cizí člověk mohl ověřovat, kdo je člen.
// Počet pokusů se omezuje podle IP i podle e-mailu (zahlcení schránky člena přihlašovacími e-maily).
export async function POST(req: NextRequest) {
  if (await ipLimited(req, "request-link-ip", { max: 10, windowSec: 600 })) {
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const email = body && typeof body === "object" ? String((body as Record<string, unknown>).email ?? "").trim() : "";
  if (!email || email.length > 200) return NextResponse.json({ error: "chybí e-mail" }, { status: 400 });

  // Víc než 3 odkazy za 10 minut na jeden e-mail neposíláme; odpověď zůstává stejná, jen se nic neodešle.
  if (await rateLimited("request-link-email", emailKey(email), { max: 3, windowSec: 600 })) {
    return NextResponse.json({ ok: true });
  }

  const user = await users.byEmail(email);
  if (user) {
    const token = await createMagicLinkToken(user.email);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://rezervace.ateliernapobrezi.cz";
    const link = `${appUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;
    await sendMagicLinkEmail(user, link);
  }

  return NextResponse.json({ ok: true });
}
