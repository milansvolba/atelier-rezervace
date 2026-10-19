import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/data";
import { signupStore } from "@/lib/signups";
import { courseFlags } from "@/lib/courseFlags";
import { discountStore, computePrice } from "@/lib/discounts";
import { createCheckoutSession, paymentStore, MAX_ONLINE_SEATS } from "@/lib/stripe";

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
  const body = await req.json();
  const { bookingId, name, contact, people, note, honeypot } = body;

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

  if (booking.capacity) {
    const confirmed = await signupStore.confirmedPeopleForBooking(booking.id);
    const held = await paymentStore.heldPeople(booking.id);
    if (confirmed + held + seats > booking.capacity) {
      return NextResponse.json({ error: "Na tomto termínu už není dost volných míst." }, { status: 409 });
    }
  }

  const tiers = await discountStore.all();
  const price = computePrice(booking.price, seats, booking.capacity ?? null, tiers);
  const contactStr = String(contact).trim();
  const email = contactStr.includes("@") ? contactStr : undefined;

  try {
    const session = await createCheckoutSession({
      amountCzk: price.totalAfterDiscount,
      productName: booking.title + " — " + fmtDate(booking.date) + ", " + seats + " " + seatsWord(seats),
      customerEmail: email,
      metadata: {
        bookingId: booking.id,
        name: String(name).slice(0, 200),
        contact: contactStr.slice(0, 200),
        people: String(seats),
        note: String(note ?? "").slice(0, 300),
      },
      successUrl: APP_URL + "/kurzy?platba=ok",
      cancelUrl: APP_URL + "/kurzy?platba=zrusena",
    });
    await paymentStore.addAwaiting(session.id, booking.id, seats);
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[stripe] Vytvoření platby selhalo:", err);
    return NextResponse.json({ error: "Platbu se nepodařilo zahájit, zkuste to prosím znovu." }, { status: 502 });
  }
}
