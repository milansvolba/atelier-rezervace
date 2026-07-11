import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/data";
import { Booking } from "@/lib/types";
import { sendAdminNewRequestEmail, sendRequesterReceivedEmail } from "@/lib/email";

// POST /api/requests — veřejný formulář žádosti o pronájem ateliéru / rezervaci místa.
// Nevytváří potvrzenou rezervaci, jen "pending" záznam čekající na schválení adminem.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { resource, date, startTime, endTime, title, requesterName, requesterContact, note, category } = body;
  if (!resource || !date || !startTime || !endTime || !requesterName || !requesterContact) {
    return NextResponse.json({ error: "chybí povinné údaje" }, { status: 400 });
  }
  const booking: Booking = {
    id: crypto.randomUUID(),
    resource,
    date,
    startTime,
    endTime,
    title: title || (category === "kurz" ? `Poptávka kurzu od ${requesterName}` : `Žádost od ${requesterName}`),
    requesterName,
    requesterContact,
    note,
    status: "pending",
    source: "public",
    createdAt: new Date().toISOString(),
    category: category === "kurz" ? "kurz" : "pronajem",
  };
  await store.add(booking);

  await Promise.all([sendAdminNewRequestEmail(booking), sendRequesterReceivedEmail(booking)]);

  return NextResponse.json(booking, { status: 201 });
}
