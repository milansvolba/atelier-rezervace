import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/data";
import { Booking } from "@/lib/types";

// POST /api/requests — veřejný formulář žádosti o pronájem ateliéru / rezervaci místa.
// Nevytváří potvrzenou rezervaci, jen "pending" záznam čekající na schválení adminem.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { resource, date, startTime, endTime, title, requesterName, requesterContact, note } = body;
  if (!resource || !date || !startTime || !endTime || !requesterName || !requesterContact) {
    return NextResponse.json({ error: "chybí povinné údaje" }, { status: 400 });
  }
  const booking: Booking = {
    id: crypto.randomUUID(),
    resource,
    date,
    startTime,
    endTime,
    title: title || `Žádost od ${requesterName}`,
    requesterName,
    requesterContact,
    note,
    status: "pending",
    source: "public",
    createdAt: new Date().toISOString(),
  };
  store.add(booking);

  // TODO: až bude appka mít napojený e-mail (Resend), odsud odeslat:
  // 1) upozornění adminům s deep linkem /admin?focus=<booking.id>
  // 2) potvrzení přijetí žadateli — texty jsou hotové ve specifikaci.

  return NextResponse.json(booking, { status: 201 });
}
