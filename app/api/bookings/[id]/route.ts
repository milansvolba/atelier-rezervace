import { NextRequest, NextResponse } from "next/server";
import { store, findConflict, findPrepConflictFor } from "@/lib/data";
import { prepMessage, PrepRole } from "@/lib/prep";
import { requireUser } from "@/lib/auth";
import { isValidCourseType } from "@/lib/pricing";
import { sendBookingChangedEmail, sendBookingCancelledEmail, notifyCourseSignups } from "@/lib/email";
import { signupStore } from "@/lib/signups";

// Admin smí zasahovat do čehokoli, člen jen do rezervací, které sám založil.
function canManage(session: { id: string; role: string }, existing: { userId?: string }) {
  return session.role === "admin" || (!!existing.userId && existing.userId === session.id);
}

// PATCH /api/bookings/:id — úprava existující rezervace (místo, čas, kdo, kontakt).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireUser(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const { resource, date, startTime, endTime, title, requesterContact, notify, category, capacity, price, courseType, confirmPending } = body;

  const all = await store.all();
  const existing = all.find((b) => b.id === params.id);
  if (!existing) return NextResponse.json({ error: "rezervace nenalezena" }, { status: 404 });
  if (!canManage(session, existing)) {
    return NextResponse.json({ error: "K úpravě této rezervace nemáte oprávnění." }, { status: 403 });
  }

  // Typ kurzu mění jen admin a jen u kurzu; neplatná hodnota je chyba, ne tiché ignorování.
  if (courseType !== undefined && courseType !== "") {
    if (session.role !== "admin" || (category ?? existing.category) !== "kurz") {
      return NextResponse.json({ error: "Typ kurzu může měnit jen administrátor u termínu kurzu." }, { status: 403 });
    }
    if (!isValidCourseType(courseType)) return NextResponse.json({ error: "Neznámý typ kurzu." }, { status: 400 });
  }

  const nextResource = resource ?? existing.resource;
  const nextDate = date ?? existing.date;
  const nextStart = startTime ?? existing.startTime;
  const nextEnd = endTime ?? existing.endTime;

  const conflict = await findConflict(nextResource, nextDate, nextStart, nextEnd, existing.id);
  if (conflict) {
    return NextResponse.json(
      { error: `Termín koliduje s existující rezervací: ${conflict.title} (${conflict.startTime}–${conflict.endTime})` },
      { status: 409 }
    );
  }

  // Změna místa/času u kurzu s čekajícími přihláškami: nejdřív je přijmout nebo odmítnout, případně jim zavolat (e-mail dostanou jen potvrzení).
  const movedCourse = existing.category === "kurz" && (existing.resource !== nextResource || existing.date !== nextDate || existing.startTime !== nextStart || existing.endTime !== nextEnd);
  if (movedCourse && !confirmPending) {
    const guard = await pendingGuard(existing.id);
    if (guard) return guard;
  }

  const prepRole: PrepRole = session.role === "admin" ? "admin" : "member";
  const prep = await findPrepConflictFor({ resource: nextResource, date: nextDate, startTime: nextStart, endTime: nextEnd }, prepRole, existing.id);
  if (prep) {
    return NextResponse.json({ error: prepMessage(prepRole, prep.kind) }, { status: 409 });
  }

  const updated = await store.update(params.id, {
    resource: nextResource,
    date: nextDate,
    startTime: nextStart,
    endTime: nextEnd,
    title,
    requesterContact,
    category,
    capacity: capacity === "" || capacity === undefined ? undefined : Number(capacity),
    price: price === "" || price === undefined ? undefined : Number(price),
    courseType: courseType === "" ? undefined : courseType,
  });

  const contact = requesterContact || existing.requesterContact;
  // Oznámení o změně termínu jen když se opravdu změnilo místo nebo čas (změna ceny či kapacity zákazníka neposílá).
  const moved = updated && (existing.resource !== updated.resource || existing.date !== updated.date || existing.startTime !== updated.startTime || existing.endTime !== updated.endTime);
  if (notify && updated && moved) {
    if (contact) await sendBookingChangedEmail(contact, existing, updated);
    // U termínu kurzu se o změně dozví i přihlášení účastníci (obdarovaný, jinak kupující), ne jen kontakt u rezervace.
    if (existing.category === "kurz" || updated.category === "kurz") {
      const signups = await signupStore.byBooking(existing.id);
      await notifyCourseSignups(signups, (to) => sendBookingChangedEmail(to, existing, updated), contact ? [contact] : []);
    }
  }

  return NextResponse.json(updated);
}

// DELETE /api/bookings/:id — smazání rezervace, volitelně s upozorněním žadatele.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireUser(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let notify = false;
  let confirmPending = false;
  try {
    const body = await req.json();
    notify = !!body?.notify;
    confirmPending = !!body?.confirmPending;
  } catch {
    // tělo je nepovinné — smazání bez upozornění
  }

  const all = await store.all();
  const existing = all.find((b) => b.id === params.id);
  if (!existing) return NextResponse.json({ error: "rezervace nenalezena" }, { status: 404 });
  if (!canManage(session, existing)) {
    return NextResponse.json({ error: "K mazání této rezervace nemáte oprávnění." }, { status: 403 });
  }

  if (existing.category === "kurz" && !confirmPending) {
    const guard = await pendingGuard(existing.id);
    if (guard) return guard;
  }

  // Přihlášky načteme před smazáním, ať víme, komu napsat.
  const signups = existing.category === "kurz" ? await signupStore.byBooking(existing.id) : [];

  await store.remove(params.id);

  if (notify) {
    if (existing.requesterContact) await sendBookingCancelledEmail(existing.requesterContact, existing);
    if (signups.length > 0) {
      await notifyCourseSignups(signups, (to) => sendBookingCancelledEmail(to, existing), existing.requesterContact ? [existing.requesterContact] : []);
    }
  }

  return NextResponse.json({ ok: true });
}

// Čekající přihlášky (ke schválení) e-mail o změně ani zrušení termínu nedostanou, proto před takovou změnou
// vrátíme seznam a admin se rozhodne: přihlášky nejdřív vyřídit, nebo lidem zavolat a pokračovat (confirmPending).
async function pendingGuard(bookingId: string) {
  const pending = (await signupStore.byBooking(bookingId)).filter((s) => s.status === "pending");
  if (pending.length === 0) return null;
  return NextResponse.json(
    {
      error: "Na tomto termínu čekají přihlášky ke schválení. Nejdřív je přijměte nebo odmítněte.",
      code: "pending_signups",
      pending: pending.map((s) => ({ name: s.name, contact: s.contact, phone: s.phone ?? null, people: s.people })),
    },
    { status: 409 }
  );
}
