import { NextRequest, NextResponse } from "next/server";
import { store, findConflict } from "@/lib/data";
import { requireUser } from "@/lib/auth";
import { sendBookingChangedEmail, sendBookingCancelledEmail } from "@/lib/email";

// Admin smí zasahovat do čehokoli, člen jen do rezervací, které sám založil.
function canManage(session: { id: string; role: string }, existing: { userId?: string }) {
  return session.role === "admin" || (!!existing.userId && existing.userId === session.id);
}

// PATCH /api/bookings/:id — úprava existující rezervace (místo, čas, kdo, kontakt).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireUser(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const { resource, date, startTime, endTime, title, requesterContact, notify, category, capacity, price } = body;

  const all = await store.all();
  const existing = all.find((b) => b.id === params.id);
  if (!existing) return NextResponse.json({ error: "rezervace nenalezena" }, { status: 404 });
  if (!canManage(session, existing)) {
    return NextResponse.json({ error: "K úpravě této rezervace nemáte oprávnění." }, { status: 403 });
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
  });

  const contact = requesterContact || existing.requesterContact;
  if (notify && contact && updated) {
    await sendBookingChangedEmail(contact, existing, updated);
  }

  return NextResponse.json(updated);
}

// DELETE /api/bookings/:id — smazání rezervace, volitelně s upozorněním žadatele.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireUser(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let notify = false;
  try {
    const body = await req.json();
    notify = !!body?.notify;
  } catch {
    // tělo je nepovinné — smazání bez upozornění
  }

  const all = await store.all();
  const existing = all.find((b) => b.id === params.id);
  if (!existing) return NextResponse.json({ error: "rezervace nenalezena" }, { status: 404 });
  if (!canManage(session, existing)) {
    return NextResponse.json({ error: "K mazání této rezervace nemáte oprávnění." }, { status: 403 });
  }

  await store.remove(params.id);

  if (notify && existing.requesterContact) {
    await sendBookingCancelledEmail(existing.requesterContact, existing);
  }

  return NextResponse.json({ ok: true });
}
