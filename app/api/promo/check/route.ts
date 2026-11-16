import { NextRequest, NextResponse } from "next/server";
import { promoStore, promoAttemptStart, promoAttemptSucceeded, clientIpHash, describePromo, GENERIC_PROMO_ERROR } from "@/lib/promo";

export const dynamic = "force-dynamic";

// POST /api/promo/check — ověří slevový kód při objednávce. Nic nezapisuje (kód se spotřebuje až po zaplacení).
// Tělo: { code, scope: "kurz" | "poukaz", bookingId? }. Cena se vždy znovu počítá na serveru při platbě;
// tohle jen ukáže zákazníkovi, jakou slevu kód dává. Neúspěšné pokusy se počítají podle IP (hádání kódů).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const scope = body.scope === "poukaz" ? "poukaz" : "kurz";
  const attempt = await promoAttemptStart(clientIpHash(req));
  if (attempt.blocked) {
    return NextResponse.json({ error: "Zadáno příliš mnoho neplatných kódů. Zkuste to prosím za chvíli." }, { status: 429 });
  }
  const bookingId = typeof body.bookingId === "string" ? body.bookingId.slice(0, 100) : undefined;
  const promo = await promoStore.validate(body.code, { scope, bookingId });
  // Stejná odpověď pro neexistující, použitý, prošlý i právě rozdělaný kód, aby se kódy nedaly zjišťovat.
  if (!promo) return NextResponse.json({ error: GENERIC_PROMO_ERROR }, { status: 404 });
  await promoAttemptSucceeded(attempt.id);
  return NextResponse.json({
    ok: true,
    code: promo.code,
    kind: promo.kind,
    value: promo.value,
    maxPeople: promo.maxPeople,
    text: describePromo(promo),
    expiresAt: promo.expiresAt.slice(0, 10),
  });
}
