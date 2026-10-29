import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/data";
import { signupStore } from "@/lib/signups";
import { courseFlags } from "@/lib/courseFlags";
import { computeOrder, voucherCourse, clampCastings } from "@/lib/pricing";
import { createCheckoutSession, paymentStore, MAX_ONLINE_SEATS } from "@/lib/stripe";
import { parseBillingInput } from "@/lib/billingInput";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://rezervace.ateliernapobrezi.cz";

function fmtDate(dateISO: string) {
  const [y, m, d] = dateISO.split("-").map(Number);
  return d + ". " + m + ". " + y;
}

function peopleWord(n: number) {
  return n === 1 ? "osoba" : n <= 4 ? "osoby" : "osob";
}

// POST /api/vouchers/checkout — veřejný nákup dárkového poukazu na kurz S PLATBOU HNED.
// Cena se počítá vždy tady na serveru z VOUCHER_COURSES (lib/pricing.ts) včetně skupinové slevy;
// klient částku neposílá. Poukaz (tabulka vouchers) vznikne až po zaplacení ve webhooku
// /api/stripe/webhook, větev meta.kind === "voucher" (lib/vouchers.ts, handleVoucherPaid).
//
// Tělo: { topic: "hlava"|"relief", people, casting? (počet odlitků 0 až people), bookingId?, buyerName, buyerEmail,
//         recipientName?, message?, honeypot? }
// bookingId je volitelný pevný termín; bez něj si obdarovaný termín vybere sám později.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { topic, people, casting, bookingId, buyerName, buyerEmail, recipientName, message, heardAbout, honeypot, billing } = body;

  if (honeypot) return NextResponse.json({ ok: true }, { status: 201 });

  const course = voucherCourse(String(topic ?? ""));
  if (!course) return NextResponse.json({ error: "neznámý kurz" }, { status: 400 });

  const name = String(buyerName ?? "").trim();
  const email = String(buyerEmail ?? "").trim();
  if (!name) return NextResponse.json({ error: "Vyplňte prosím jméno kupujícího." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Vyplňte prosím platný e-mail, pošleme na něj poukaz." }, { status: 400 });
  }

  const seats = Math.floor(Number(people) || 1);
  if (seats < 1) return NextResponse.json({ error: "neplatný počet osob" }, { status: 400 });
  if (seats > MAX_ONLINE_SEATS) {
    return NextResponse.json(
      { error: "Online lze zaplatit nejvýše " + MAX_ONLINE_SEATS + " osob. Pro větší skupinu nám prosím pošlete poptávku." },
      { status: 400 }
    );
  }

  // Volitelný pevný termín: musí to být budoucí potvrzený termín stejného kurzu, ne firemní akce.
  let booking = null;
  if (bookingId) {
    const all = await store.all();
    const today = new Date().toISOString().slice(0, 10);
    booking = all.find((b) => b.id === bookingId && b.category === "kurz") ?? null;
    if (!booking || booking.status !== "confirmed" || booking.date < today) {
      return NextResponse.json({ error: "Zvolený termín už není k dispozici." }, { status: 404 });
    }
    if (!booking.title.toLowerCase().includes(course.match)) {
      return NextResponse.json({ error: "Zvolený termín nepatří k tomuto kurzu." }, { status: 400 });
    }
    if (await courseFlags.isCorporate(booking.id)) {
      return NextResponse.json({ error: "Na tuto akci se nelze veřejně přihlásit." }, { status: 403 });
    }
    // Dřívější nedokončený pokus téhož kupujícího (stejný e-mail) nesmí blokovat místa pro další pokus.
    await paymentStore.releaseHolds(booking.id, email.toLowerCase()).catch(() => 0);
    if (booking.capacity) {
      const confirmed = await signupStore.confirmedPeopleForBooking(booking.id);
      const held = await paymentStore.heldPeople(booking.id);
      if (confirmed + held + seats > booking.capacity) {
        return NextResponse.json({ error: "Na tomto termínu už není dost volných míst." }, { status: 409 });
      }
    }
  }

  // Množstevní sleva podle počtu osob + volitelný betonový odlitek pro každou osobu (lib/pricing.ts).
  const castings = clampCastings(casting, seats);
  const price = computeOrder(course.pricePerPerson, seats, castings, course.castingPrice);

  const billingCheck = parseBillingInput(billing, price.total);
  if (!billingCheck.ok) return NextResponse.json({ error: billingCheck.error }, { status: 400 });

  try {
    const session = await createCheckoutSession({
      amountCzk: price.courseAfter,
      extraItems: castings > 0 ? [{ name: "Betonový odlitek — " + course.title, amountCzk: course.castingPrice, quantity: castings }] : undefined,
      productName:
        "Dárkový poukaz — " + course.title + ", " + seats + " " + peopleWord(seats) +
        (booking ? " (termín " + fmtDate(booking.date) + ")" : ""),
      customerEmail: email,
      metadata: {
        kind: "voucher",
        topic: course.key,
        people: String(seats),
        casting: String(castings),
        bookingId: booking ? booking.id : "",
        buyerName: name.slice(0, 200),
        buyerEmail: email.slice(0, 200),
        recipientName: String(recipientName ?? "").trim().slice(0, 100),
        message: String(message ?? "").trim().slice(0, 300),
        heardAbout: String(heardAbout ?? "").trim().slice(0, 200),
      },
      successUrl: APP_URL + "/poukazy?platba=ok",
      cancelUrl: APP_URL + "/poukazy?platba=zrusena",
    });
    // U pevného termínu se místa po dobu platby drží; bez termínu jde jen o záznam platby (idempotence webhooku).
    await paymentStore.addAwaiting(session.id, booking ? booking.id : "voucher", seats, billingCheck.value, email.toLowerCase());
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[stripe] Vytvoření platby poukazu selhalo:", err);
    return NextResponse.json({ error: "Platbu se nepodařilo zahájit, zkuste to prosím znovu." }, { status: 502 });
  }
}
