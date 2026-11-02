import { NextRequest, NextResponse } from "next/server";
import { validateContact, looksLikeSpam, hashIp, saveContactMessage, isRateLimited } from "@/lib/contactMessage";
import { sendContactMessageEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// POST /api/contact-message: kontaktní formulář na hlavním webu (ateliernapobrezi.cz/kontakt).
// Tělo: { name, email, message, honeypot? }. Web je na jiné doméně než rezervace, proto CORS jen pro náš web.
// Zpráva se nejdřív uloží do databáze (nezmizí, ani když e-mail selže), potom se pošle e-mail
// adminům s Reply-To na odesílatele.

const ALLOWED_ORIGINS = new Set([
  "https://ateliernapobrezi.cz",
  "https://www.ateliernapobrezi.cz",
  "https://rezervace.ateliernapobrezi.cz",
]);

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);
  const reply = (body: Record<string, unknown>, status: number) => NextResponse.json(body, { status, headers });

  // Prohlížeč vždy pošle Origin. Cizí stránka tak formulář odeslat nemůže.
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return reply({ error: "Odeslání z tohoto místa není povolené." }, 403);
  }

  const body = await req.json().catch(() => null);
  // Past na roboty: pole, které člověk nevidí. Robotovi předstíráme úspěch.
  if (body && typeof body === "object" && (body as Record<string, unknown>).honeypot) return reply({ ok: true }, 201);

  const parsed = validateContact(body);
  if (!parsed.ok) return reply({ error: parsed.error }, 400);
  const { value } = parsed;
  if (looksLikeSpam(value.message)) return reply({ ok: true }, 201);

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0] || req.headers.get("x-real-ip");
  const ipHash = hashIp(ip);

  try {
    if (await isRateLimited(value.email, ipHash)) {
      return reply({ error: "Zprávu jste nám právě poslali. Zkuste to prosím za chvíli, nebo nám zavolejte." }, 429);
    }
    await saveContactMessage(value, ipHash);
  } catch (err) {
    console.error("[contact-message] Uložení zprávy selhalo:", err);
    return reply({ error: "Zprávu se nepodařilo odeslat. Napište nám prosím e-mailem nebo zavolejte." }, 500);
  }

  // Zpráva je uložená. Selhání e-mailu se zapíše do email_log a zákazníka nezastaví.
  await sendContactMessageEmail(value);
  return reply({ ok: true }, 201);
}
