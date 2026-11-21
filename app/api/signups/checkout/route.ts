import { NextRequest, NextResponse } from "next/server";
import { ipLimited, TOO_MANY } from "@/lib/rateLimit";
import { store } from "@/lib/data";
import { signupStore } from "@/lib/signups";
import { courseFlags } from "@/lib/courseFlags";
import { cleanPhone } from "@/lib/signupContact";
import { computeOrder, castingPriceFor, clampCastings, hasGroupDiscount } from "@/lib/pricing";
import { createCheckoutSession, paymentStore, MAX_ONLINE_SEATS } from "@/lib/stripe";
import { parseBillingInput } from "@/lib/billingInput";
import { promoStore, promoAttemptStart, promoAttemptSucceeded, clientIpHash, maxPeopleMessage, GENERIC_PROMO_ERROR, PROMO_MIN_FIXED_PRICE, type PromoCode } from "@/lib/promo";
import { expireStripeSession } from "@/lib/stripe";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://rezervace.ateliernapobrezi.cz";

function fmtDate(dateISO: string) {
  const [y, m, d] = dateISO.split("-").map(Number);
  return d + ". " + m + ". " + y;
}

function seatsWord(n: number) {
  return n === 1 ? "místo" : n <= 4 ? "místa" : "míst";
}

// POST /api/signups/checkout — veřejná přihláška na vypsaný termín kurzu S PLATBOU HNED.
// Cena se počítá vždy tady na serveru (včetně skupinové slevy podle počtu míst v objednávce),
// klient nikdy neposílá částku. Místa se po dobu platby drží (tabulka payments), přihláška
// (course_signups) vznikne až po zaplacení ve webhooku /api/stripe/webhook.
export async function POST(req: NextRequest) {
  // Omezení počtu požadavků z jedné IP (spam, zahlcení e-mailů, blokování míst).
  if (await ipLimited(req, "signups-checkout", { max: 8, windowSec: 1800 })) return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  const body = await req.json();
  const { bookingId, name, contact, people, note, phone, honeypot, casting, heardAbout, billing, promoCode } = body;

  if (honeypot) return NextResponse.json({ ok: true }, { status: 201 });

  if (!bookingId || !name || !contact) {
    return NextResponse.json({ error: "chybí povinné údaje" }, { status: 400 });
  }
  const seats = Math.floor(Number(people) || 1);
  if (seats < 1) return NextResponse.json({ error: "neplatný počet míst" }, { status: 400 });
  if (seats > MAX_ONLINE_SEATS) {
    return NextResponse.json(
      { error: "Online lze zaplatit nejvýše " + MAX_ONLINE_SEATS + " míst. Pro větší skupinu nám prosím pošlete poptávku." },
      { status: 400 }
    );
  }

  const all = await store.all();
  const booking = all.find((b) => b.id === bookingId && b.category === "kurz");
  if (!booking) return NextResponse.json({ error: "kurz nenalezen" }, { status: 404 });
  // Firemní akce: online platba není možná (řeší se domluvou/fakturou).
  if (await courseFlags.isCorporate(bookingId)) {
    return NextResponse.json({ error: "Na tuto akci se nelze veřejně přihlásit." }, { status: 403 });
  }
  if (!booking.price) return NextResponse.json({ error: "Tento termín nelze zaplatit online." }, { status: 400 });

  // Dřívější nedokončený pokus téhož zákazníka (stejný e-mail) nesmí blokovat místa pro další pokus.
  const holdKey = String(contact).trim().toLowerCase();
  await paymentStore.releaseHolds(booking.id, holdKey).catch(() => 0);

  if (booking.capacity) {
    const confirmed = await signupStore.confirmedPeopleForBooking(booking.id);
    const held = await paymentStore.heldPeople(booking.id);
    if (confirmed + held + seats > booking.capacity) {
      return NextResponse.json({ error: "Na tomto termínu už není dost volných míst." }, { status: 409 });
    }
  }

  // Množstevní sleva podle počtu lidí + volitelný betonový odlitek pro každého účastníka (lib/pricing.ts).
  const castingPrice = castingPriceFor(booking);
  const castings = castingPrice !== null ? clampCastings(casting, seats) : 0;

  // Volitelný jednorázový slevový kód (lib/promo.ts). Jen pro čtení; zarezervuje se až těsně před platbou.
  let promo: PromoCode | null = null;
  const promoRaw = typeof promoCode === "string" ? promoCode.trim() : "";
  if (promoRaw) {
    const attempt = await promoAttemptStart(clientIpHash(req));
    if (attempt.blocked) {
      return NextResponse.json({ error: "Zadáno příliš mnoho neplatných kódů. Zkuste to prosím za chvíli, nebo nám napište." }, { status: 429 });
    }
    promo = await promoStore.validate(promoRaw, { scope: "kurz", bookingId: booking.id }, holdKey);
    if (!promo) return NextResponse.json({ error: GENERIC_PROMO_ERROR }, { status: 400 });
    await promoAttemptSucceeded(attempt.id);
    if (seats > promo.maxPeople) return NextResponse.json({ error: maxPeopleMessage(promo.maxPeople) }, { status: 400 });
  }
  const price = computeOrder(booking.price, seats, castings, castingPrice ?? 0, promo, hasGroupDiscount(booking));
  if (promo && !price.promoApplied) {
    return NextResponse.json({ error: "U vaší objednávky je výhodnější množstevní sleva, kód proto nepoužijeme (zůstává platný). Odeberte ho prosím z objednávky." }, { status: 400 });
  }
  if (promo && price.courseAfter + price.castingTotal < PROMO_MIN_FIXED_PRICE) {
    return NextResponse.json({ error: "Po uplatnění kódu je cena pod minimem pro platbu kartou. Napište nám prosím." }, { status: 400 });
  }
  const billingCheck = parseBillingInput(billing, price.total);
  if (!billingCheck.ok) return NextResponse.json({ error: billingCheck.error }, { status: 400 });
  if (billingCheck.value?.isCompany) {
    return NextResponse.json({ error: "Firmy neplatí kartou. Odešlete prosím poptávku, ozveme se vám s nabídkou a fakturou." }, { status: 400 });
  }
  const cleanedPhone = cleanPhone(phone);
  if (phone && String(phone).trim() && !cleanedPhone) {
    return NextResponse.json({ error: "Zkontrolujte prosím telefon (9 až 15 číslic)." }, { status: 400 });
  }
  const contactStr = String(contact).trim();
  const email = contactStr.includes("@") ? contactStr : undefined;

  // Místa si nejdřív zarezervujeme v databázi a teprve potom ověříme kapacitu: dva zákazníci, kteří klikli
  // ve stejný okamžik na poslední místa, se tak nikdy nedostanou oba k platbě (při souběhu radši neprojde žádný).
  const tmpId = "pending_" + crypto.randomUUID();
  await paymentStore.addAwaiting(tmpId, booking.id, seats, billingCheck.value, holdKey);
  if (booking.capacity) {
    const confirmedNow = await signupStore.confirmedPeopleForBooking(booking.id);
    const heldNow = await paymentStore.heldPeople(booking.id);
    if (confirmedNow + heldNow > booking.capacity) {
      await paymentStore.removeAwaiting(tmpId);
      return NextResponse.json({ error: "Na tomto termínu už není dost volných míst." }, { status: 409 });
    }
  }

  // Kód se zarezervuje atomicky těsně před platbou: dva souběžné pokusy se stejným kódem neprojdou oba.
  if (promo && !(await promoStore.reserveForCheckout(promo.code, { scope: "kurz", bookingId: booking.id }, tmpId, holdKey))) {
    await paymentStore.removeAwaiting(tmpId).catch(() => undefined);
    return NextResponse.json({ error: GENERIC_PROMO_ERROR }, { status: 409 });
  }

  let createdSession: string | null = null;
  try {
    const session = await createCheckoutSession({
      amountCzk: price.courseAfter,
      extraItems: castings > 0 ? [{ name: "Betonový odlitek — " + booking.title, amountCzk: castingPrice as number, quantity: castings }] : undefined,
      // „Včetně občerstvení“ je na dokladu ze Stripe záměrně: občerstvení je součástí ceny kurzu (účetní opatření, schváleno Milanem 2026-11-12).
      productName: booking.title + " — " + fmtDate(booking.date) + ", " + seats + " " + seatsWord(seats) + ", včetně občerstvení" + (promo ? " (po slevě kódem)" : ""),
      customerEmail: email,
      metadata: {
        bookingId: booking.id,
        name: String(name).slice(0, 200),
        contact: contactStr.slice(0, 200),
        phone: cleanedPhone ?? "",
        people: String(seats),
        casting: String(castings),
        note: String(note ?? "").slice(0, 300),
        heardAbout: String(heardAbout ?? "").trim().slice(0, 200),
        promo: promo ? promo.code : "",
      },
      successUrl: APP_URL + "/dekujeme?termin=" + encodeURIComponent(booking.id),
      cancelUrl: APP_URL + "/kurzy?platba=zrusena",
    });
    createdSession = session.id;
    await paymentStore.renameSession(tmpId, session.id);
    if (promo) await promoStore.attachSession(tmpId, session.id);
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[stripe] Vytvoření platby selhalo:", err);
    await paymentStore.removeAwaiting(tmpId).catch(() => undefined);
    // Platební stránka už mohla vzniknout: nejdřív ji ukončíme, teprve potom smí být kód zase volný.
    if (promo) {
      if (createdSession) await expireStripeSession(createdSession).catch(() => false);
      await promoStore.release(createdSession ?? tmpId).catch(() => undefined);
    }
    return NextResponse.json({ error: "Platbu se nepodařilo zahájit, zkuste to prosím znovu." }, { status: 502 });
  }
}
