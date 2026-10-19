import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/data";
import { signupStore } from "@/lib/signups";
import { courseFlags } from "@/lib/courseFlags";
import { voucherCourse } from "@/lib/pricing";
import { paymentStore } from "@/lib/stripe";
import { voucherStore, isExpired } from "@/lib/vouchers";
import { sendVoucherRedeemedEmails } from "@/lib/email";
import { CourseSignup } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST /api/vouchers/redeem — uplatnění dárkového poukazu na vypsaný termín kurzu (z /kurzy).
// Tělo: { code, bookingId, name?, contact?, note?, dryRun?, honeypot? }
//  - dryRun: true → jen ověří kód a termín a vrátí údaje poukazu (počet osob, odlitek), nic nezapisuje.
//  - jinak: poukaz atomicky označí jako uplatněný a vytvoří potvrzenou přihlášku na celý počet osob poukazu.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { code, bookingId, name, contact, note, dryRun, honeypot } = body;
  if (honeypot) return NextResponse.json({ ok: true }, { status: 201 });

  const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

  const voucher = code ? await voucherStore.byCode(String(code)) : null;
  // Stejná odpověď pro neexistující kód, aby se kódy nedaly zjišťovat.
  if (!voucher) return bad("Poukaz s tímto kódem jsme nenašli. Zkontrolujte prosím kód.", 404);
  if (voucher.status !== "active") return bad("Tento poukaz už byl uplatněn.", 409);
  if (isExpired(voucher)) return bad("Platnost poukazu vypršela.", 410);
  if (voucher.bookingId) {
    return bad("Tento poukaz už je přiřazen ke konkrétnímu termínu a místo na něm máte potvrzené.", 409);
  }

  const course = voucherCourse(voucher.topic);
  const booking = bookingId ? (await store.all()).find((b) => b.id === bookingId && b.category === "kurz") : null;
  const today = new Date().toISOString().slice(0, 10);
  if (!course || !booking || booking.status !== "confirmed" || booking.date < today) {
    return bad("Zvolený termín už není k dispozici.", 404);
  }
  if (!booking.title.toLowerCase().includes(course.match)) {
    return bad("Poukaz je na jiný kurz (" + voucher.courseTitle + "), než je zvolený termín.", 400);
  }
  if (await courseFlags.isCorporate(booking.id)) return bad("Na tuto akci se nelze veřejně přihlásit.", 403);

  if (booking.capacity) {
    const confirmed = await signupStore.confirmedPeopleForBooking(booking.id);
    const held = await paymentStore.heldPeople(booking.id);
    if (confirmed + held + voucher.people > booking.capacity) {
      return bad("Na tomto termínu není dost volných míst pro " + voucher.people + " os. z poukazu. Zvolte prosím jiný termín.", 409);
    }
  }

  if (dryRun) {
    return NextResponse.json({ ok: true, people: voucher.people, casting: voucher.casting, courseTitle: voucher.courseTitle });
  }

  const signupName = String(name ?? "").trim();
  const signupContact = String(contact ?? "").trim();
  if (!signupName) return bad("Vyplňte prosím jméno.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupContact)) return bad("Vyplňte prosím platný e-mail, pošleme na něj potvrzení.");

  if (!(await voucherStore.claim(voucher.id))) return bad("Tento poukaz už byl uplatněn.", 409);

  const signup: CourseSignup = {
    id: crypto.randomUUID(),
    bookingId: booking.id,
    name: signupName,
    contact: signupContact,
    people: voucher.people,
    note:
      "Dárkový poukaz " + voucher.code + (voucher.casting ? " (vč. betonového odlitku)" : "") + "." +
      (note ? " " + String(note).slice(0, 300) : ""),
    status: "confirmed",
    createdAt: new Date().toISOString(),
  };
  try {
    await signupStore.add(signup);
  } catch (e) {
    // Přihláška se nezapsala — poukaz vrátíme do stavu active, ať ho jde uplatnit znovu.
    console.error("[voucher] Uplatnění poukazu " + voucher.code + " selhalo při zápisu přihlášky:", e);
    await voucherStore.setStatus(voucher.id, "active");
    return bad("Poukaz se nepodařilo uplatnit, zkuste to prosím znovu.", 500);
  }

  const overbooked = booking.capacity
    ? (await signupStore.confirmedPeopleForBooking(booking.id)) > booking.capacity
    : false;
  try {
    await sendVoucherRedeemedEmails(voucher, booking, signup, overbooked);
  } catch (e) {
    console.error("[voucher] E-mail o uplatnění poukazu " + voucher.code + " se nepodařilo odeslat:", e);
  }
  return NextResponse.json({ ok: true, signupId: signup.id }, { status: 201 });
}
