import { NextRequest, NextResponse } from "next/server";
import { store, findConflict, findPrepConflictFor } from "@/lib/data";
import { prepMessage } from "@/lib/prep";
import { Booking } from "@/lib/types";
import { sendAdminNewRequestEmail, sendRequesterReceivedEmail } from "@/lib/email";

// POST /api/requests — veřejný formulář žádosti o pronájem ateliéru / rezervaci místa.
// Nevytváří potvrzenou rezervaci, jen "pending" záznam čekající na schválení adminem.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { resource, date, startTime, endTime, title, requesterName, requesterContact, note, category, heardAbout, honeypot } = body;

  if (honeypot) return NextResponse.json({ ok: true }, { status: 201 });

  if (!resource || !date || !startTime || !endTime || !requesterName || !requesterContact) {
    return NextResponse.json({ error: "chybí povinné údaje" }, { status: 400 });
  }
  // Obsazený termín (včetně akcí na celý ateliér) nejde ani požádat. Název akce se nikam nevrací.
  const conflict = await findConflict(resource, date, startTime, endTime);
  if (conflict) {
    return NextResponse.json({ error: "Tento termín je už obsazený. Vyber prosím jiný čas." }, { status: 409 });
  }
  const prep = await findPrepConflictFor({ resource, date, startTime, endTime }, "public");
  if (prep) {
    return NextResponse.json({ error: prepMessage("public", prep.kind) }, { status: 409 });
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
    heardAbout: typeof heardAbout === "string" && heardAbout.trim() ? heardAbout.trim().slice(0, 200) : undefined,
  };
  await store.add(booking);

  await Promise.all([sendAdminNewRequestEmail(booking), sendRequesterReceivedEmail(booking)]);

  return NextResponse.json(booking, { status: 201 });
}
