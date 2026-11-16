import { NextRequest, NextResponse } from "next/server";
import { promoStore, promoRateLimited, recordPromoAttempt, clientIpHash, describePromo, GENERIC_PROMO_ERROR } from "@/lib/promo";

export const dynamic = "force-dynamic";

// POST /api/promo/check — ověří slevový kód při objednávce. Nic nezapisuje (kód se spotřebuje až po zaplacení).
// Tělo: { code, scope: "kurz" | "poukaz", bookingId?, email? }. Cena se vždy znovu počítá na serveru při platbě;
// tohle jen ukáže zákazníkovi, jakou slevu kód dává. Neúspěšné pokusy se počítají podle IP (hádání kódů).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const scope = body.scope === "poukaz" ? "poukaz" : "kurz";
  const ipHash = clientIpHash(req);
  if (await promoRateLimited(ipHash)) {
    return NextResponse.json({ error: "Zadáno příliš mnoho neplatných kódů. Zkuste to prosím za chvíli." }, { status: 429 });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : undefined;
  const bookingId = typeof body.bookingId === "string" ? body.bookingId.slice(0, 100) : undefined;
  const promo = await promoStore.validate(body.code, { scope, bookingId }, email || undefined);
  await recordPromoAttempt(ipHash, !!promo);
  // Stejná odpověď pro neexistující, použitý i prošlý kód, aby se kódy nedaly zjišťovat.
  if (!promo) return NextResponse.json({ error: GENERIC_PROMO_ERROR }, { status: 404 });
  return NextResponse.json({
    ok: true,
    code: promo.code,
    kind: promo.kind,
    value: promo.value,
    text: describePromo(promo),
    expiresAt: promo.expiresAt.slice(0, 10),
  });
}
