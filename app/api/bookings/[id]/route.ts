import { NextRequest, NextResponse } from "next/server";
import { store, findConflict } from "@/lib/data";
import { requireAdmin } from "@/lib/auth";

// PATCH /api/bookings/:id — admin upravuje existující rezervaci (místo, čas, kdo, kontakt).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const { resource, date, startTime, endTime, title, requesterContact, notify } = body;

  const all = await store.all();
  const existing = all.find((b) => b.id === params.id);
  if (!existing) return NextResponse.json({ error: "rezervace nenalezena" }, { status: 404 });

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
  });

  if (notify && (requesterContact || existing.requesterContact)) {
    // TODO: až bude appka mít napojený e-mail (Resend), odsud poslat žadateli
    // upozornění o změně termínu na requesterContact ?? existing.requesterContact.
  }

  return NextResponse.json(updated);
}

// DELETE /api/bookings/:id — admin smaže rezervaci, volitelně s upozorněním žadatele.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let notify = false;
  try {
    const body = await req.json();
    notify = !!body?.notify;
  } catch {
    // tělo je nepovinné — smazání bez upozornění
  }

  const all = await store.all();
  const existing = all.find((b) => b.id === params.id);
  await store.remove(params.id);

  if (notify && existing?.requesterContact) {
    // TODO: až bude appka mít napojený e-mail (Resend), odsud poslat žadateli
    // upozornění o zrušení rezervace na existing.requesterContact.
  }

  return NextResponse.json({ ok: true });
}
