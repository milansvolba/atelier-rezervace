import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/data";
import { courseFlags } from "@/lib/courseFlags";
import { computeOrder, voucherCourse, castingPriceFor, clampCastings } from "@/lib/pricing";
import { parseBillingInput } from "@/lib/billingInput";
import { cleanPhone, validEmail } from "@/lib/signupContact";
import { sendFirmInquiryEmails } from "@/lib/email";

export const dynamic = "force-dynamic";

const ALLOWED_ORIGINS = new Set(["https://rezervace.ateliernapobrezi.cz"]);

function fmtDate(dateISO: string) {
  const [y, m, d] = dateISO.split("-").map(Number);
  return d + ". " + m + ". " + y;
}

function kc(n: number) {
  return Math.round(n).toLocaleString("cs-CZ").replace(/ /g, " ") + " Kč";
}

// POST /api/firm-inquiry: poptávka od firmy místo platby kartou (kurz nebo dárkový poukaz). Veřejné.
// Firma neplatí přes Stripe: Milan odpoví, domluví se a vystaví fakturu v Caflou. Nic se neukládá do platebních tabulek,
// místo ani poukaz se nerezervují. Cena v e-mailu je jen orientační rekapitulace (počítá ji server).
// Tělo: { kind: "kurz"|"poukaz", bookingId? (kurz, nebo pevný termín u poukazu), topic? (poukaz), people, casting?,
//         name, email, phone?, note?, heardAbout?, billing (isCompany musí být true), honeypot? }
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  const sameSite = !!origin && (ALLOWED_ORIGINS.has(origin) || (host && origin.endsWith("//" + host)));
  if (origin && !sameSite) return NextResponse.json({ error: "Odeslání z tohoto místa není povolené." }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "neplatná žádost" }, { status: 400 });
  const { kind, bookingId, topic, people, casting, name, email, phone, note, heardAbout, billing, honeypot } = body as Record<string, unknown>;
  if (honeypot) return NextResponse.json({ ok: true }, { status: 201 });

  const cleanName = String(name ?? "").trim().slice(0, 120);
  const cleanEmail = String(email ?? "").trim().slice(0, 200);
  if (!cleanName) return NextResponse.json({ error: "Vyplňte prosím jméno." }, { status: 400 });
  if (!validEmail(cleanEmail)) return NextResponse.json({ error: "Vyplňte prosím platný e-mail, ozveme se vám na něj." }, { status: 400 });
  const phoneRaw = String(phone ?? "").trim();
  const cleanedPhone = cleanPhone(phoneRaw);
  if (phoneRaw && !cleanedPhone) return NextResponse.json({ error: "Zkontrolujte prosím telefon (9 až 15 číslic)." }, { status: 400 });

  const seats = Math.floor(Number(people) || 1);
  if (seats < 1 || seats > 50) return NextResponse.json({ error: "neplatný počet osob" }, { status: 400 });

  const lines: string[] = [];
  let total = 0;
  let kindLabel = "";
  if (kind === "kurz") {
    kindLabel = "Kurz";
    const all = await store.all();
    const booking = all.find((b) => b.id === bookingId && b.category === "kurz");
    if (!booking || !booking.price) return NextResponse.json({ error: "kurz nenalezen" }, { status: 404 });
    if (await courseFlags.isCorporate(booking.id)) return NextResponse.json({ error: "Na tuto akci se nelze veřejně přihlásit." }, { status: 403 });
    const castingPrice = castingPriceFor(booking);
    const castings = castingPrice !== null ? clampCastings(casting, seats) : 0;
    const price = computeOrder(booking.price, seats, castings, castingPrice ?? 0);
    total = price.total;
    lines.push(booking.title + ", " + fmtDate(booking.date) + " " + booking.startTime + "–" + booking.endTime);
    lines.push("Počet osob: " + seats + (castings > 0 ? ", odlitků: " + castings : ""));
    lines.push("Orientační cena vč. DPH: " + kc(price.total) + (price.discountPercent > 0 ? " (skupinová sleva " + price.discountPercent + " %)" : ""));
  } else if (kind === "poukaz") {
    kindLabel = "Dárkový poukaz";
    const course = voucherCourse(String(topic ?? ""));
    if (!course) return NextResponse.json({ error: "neznámý kurz" }, { status: 400 });
    const castings = clampCastings(casting, seats);
    const price = computeOrder(course.pricePerPerson, seats, castings, course.castingPrice);
    total = price.total;
    lines.push("Poukaz na kurz: " + course.title);
    lines.push("Počet osob: " + seats + (castings > 0 ? ", odlitků: " + castings : ""));
    lines.push("Orientační cena vč. DPH: " + kc(price.total) + (price.discountPercent > 0 ? " (skupinová sleva " + price.discountPercent + " %)" : ""));
    if (bookingId) {
      const all = await store.all();
      const t = all.find((b) => b.id === bookingId && b.category === "kurz");
      if (t) lines.push("Pevný termín: " + fmtDate(t.date) + " " + t.startTime + "–" + t.endTime);
    }
  } else {
    return NextResponse.json({ error: "neznámý druh poptávky" }, { status: 400 });
  }

  const b = (billing && typeof billing === "object" ? billing : {}) as Record<string, unknown>;
  if (b.isCompany !== true) return NextResponse.json({ error: "Poptávku odesílají firmy. Soukromé osoby platí kartou." }, { status: 400 });
  const check = parseBillingInput(billing, total);
  if (!check.ok || !check.value) return NextResponse.json({ error: check.ok ? "Vyplňte prosím údaje firmy." : check.error }, { status: 400 });
  const v = check.value;

  const ok = await sendFirmInquiryEmails({
    kindLabel,
    lines,
    company: v.company ?? "",
    ico: v.ico ?? "",
    dic: v.dic,
    address: [v.street, [v.zip, v.city].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    name: cleanName,
    email: cleanEmail,
    phone: cleanedPhone ?? undefined,
    note: String(note ?? "").trim().slice(0, 1000) || undefined,
    heardAbout: String(heardAbout ?? "").trim().slice(0, 200) || undefined,
  });
  if (!ok) return NextResponse.json({ error: "Poptávku se nepodařilo odeslat. Napište nám prosím na info@ateliernapobrezi.cz." }, { status: 502 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
