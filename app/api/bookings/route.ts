import { NextRequest, NextResponse } from "next/server";
import { store, findConflict } from "@/lib/data";
import { Booking } from "@/lib/types";
import { requireUser } from "@/lib/auth";
import { users } from "@/lib/users";

// Veřejnosti (nepřihlášeným) vracíme jen to, co potřebuje veřejný kalendář na
// vykreslení obsazenosti — žádná jména, kontakty ani názvy rezervací.
function publicSafe(b: Booking) {
  return { id: b.id, resource: b.resource, date: b.date, startTime: b.startTime, endTime: b.endTime, status: b.status };
}

// GET /api/bookings?date=YYYY-MM-DD — přihlášení (admin/člen) vidí vše, veřejnost jen obsazenost.
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  const all = await store.all();
  const filtered = date ? all.filter((b) => b.date === date) : all;
  const session = await requireUser(req);
  return NextResponse.json(session ? filtered : filtered.map(publicSafe));
}

// POST /api/bookings — přihlášený admin/člen rovnou vytváří potvrzenou rezervaci (bez schvalování)
export async function POST(req: NextRequest) {
  const session = await requireUser(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const { resource, date, startTime, endTime, title, extraMonitor, requesterContact, memberUserId } = body;
  if (!resource || !date || !startTime || !endTime || !title) {
    return NextResponse.json({ error: "chybí povinné údaje" }, { status: 400 });
  }
  const conflict = await findConflict(resource, date, startTime, endTime);
  if (conflict) {
    return NextResponse.json(
      { error: `Termín koliduje s existující rezervací: ${conflict.title} (${conflict.startTime}–${conflict.endTime})` },
      { status: 409 }
    );
  }

  // Admin může rezervaci rovnou přiřadit konkrétnímu členovi (rozpoznanému z
  // našeptávače) — pak se objeví i v jeho vlastní sekci "Moje rezervace" a
  // dotáhne se jeho kontakt, pokud admin žádný neuvedl ručně.
  let ownerId = session.id;
  let contact = requesterContact || undefined;
  if (session.role === "admin" && memberUserId) {
    const target = await users.byId(memberUserId);
    if (target) {
      ownerId = target.id;
      contact = contact || target.email;
    }
  }

  const booking: Booking = {
    id: crypto.randomUUID(),
    resource,
    date,
    startTime,
    endTime,
    title,
    requesterContact: contact,
    extraMonitor: !!extraMonitor,
    status: "confirmed",
    source: session.role === "admin" ? "admin" : "member",
    userId: ownerId,
    createdAt: new Date().toISOString(),
  };
  await store.add(booking);
  return NextResponse.json(booking, { status: 201 });
}
