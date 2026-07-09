import { NextRequest, NextResponse } from "next/server";
import { store, findConflict } from "@/lib/data";
import { Booking } from "@/lib/types";
import { requireAdmin } from "@/lib/auth";

// GET /api/bookings?date=YYYY-MM-DD  — vrátí rezervace pro daný den (interní mřížka)
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  const all = await store.all();
  return NextResponse.json(date ? all.filter((b) => b.date === date) : all);
}

// POST /api/bookings — admin rovnou vytváří potvrzenou rezervaci (bez schvalování)
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const { resource, date, startTime, endTime, title, extraMonitor } = body;
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
  const booking: Booking = {
    id: crypto.randomUUID(),
    resource,
    date,
    startTime,
    endTime,
    title,
    extraMonitor: !!extraMonitor,
    status: "confirmed",
    source: "admin",
    createdAt: new Date().toISOString(),
  };
  await store.add(booking);
  return NextResponse.json(booking, { status: 201 });
}
