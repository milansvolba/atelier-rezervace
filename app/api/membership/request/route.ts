import { NextRequest, NextResponse } from "next/server";
import { validateRequest, looksLikeSpam, hashIp, membershipRequests } from "@/lib/membershipRequests";
import { sendAdminMembershipRequestEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// POST /api/membership/request: žádost „Chci do klubu“ z úvodní stránky /clenstvi (veřejné).
// Tělo: { name, email, phone?, message?, consent: true, honeypot? }. Žádost se uloží a adminům odejde e-mail.
// Stránka i API jsou na stejné doméně, takže cizí web formulář odeslat nemůže (kontrola Origin).
const ALLOWED_ORIGINS = new Set(["https://rezervace.ateliernapobrezi.cz"]);

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  const sameSite = !!origin && (ALLOWED_ORIGINS.has(origin) || (host && origin.endsWith("//" + host)));
  if (origin && !sameSite) {
    return NextResponse.json({ error: "Odeslání z tohoto místa není povolené." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  // Past na roboty: pole, které člověk nevidí. Robotovi předstíráme úspěch.
  if (body && typeof body === "object" && (body as Record<string, unknown>).honeypot) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const parsed = validateRequest(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { value } = parsed;
  if (looksLikeSpam(value.message)) return NextResponse.json({ ok: true }, { status: 201 });

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0] || req.headers.get("x-real-ip");
  const ipHash = hashIp(ip);

  try {
    if (await membershipRequests.isRateLimited(value.email, ipHash)) {
      return NextResponse.json(
        { error: "Žádost jsme od vás právě dostali. Zkuste to prosím za chvíli, nebo nám napište na info@ateliernapobrezi.cz." },
        { status: 429 }
      );
    }
    const saved = await membershipRequests.add(value, ipHash);
    // Žádost je uložená. Selhání e-mailu se zapíše do email_log a žadatele nezastaví.
    await sendAdminMembershipRequestEmail(saved);
  } catch (err) {
    console.error("[membership-request] Uložení žádosti selhalo:", err);
    return NextResponse.json(
      { error: "Nepodařilo se nám odeslat žádost. Zkuste to prosím znovu, nebo nám napište na info@ateliernapobrezi.cz." },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
