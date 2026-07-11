import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/data";
import { signupStore } from "@/lib/signups";
import { CourseSignup } from "@/lib/types";
import { requireAdmin } from "@/lib/auth";
import { sendAdminNewSignupEmail, sendSignupReceivedEmail } from "@/lib/email";

// POST /api/signups — veřejný formulář přihlášky na vypsaný termín kurzu.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { bookingId, name, contact, people, note, honeypot } = body;

  // Jednoduchá anti-spam past — skryté pole, které lidský návštěvník nevyplní.
  if (honeypot) return NextResponse.json({ ok: true }, { status: 201 });

  if (!bookingId || !name || !contact) {
    return NextResponse.json({ error: "chybí povinné údaje" }, { status: 400 });
  }
  const all = await store.all();
  const booking = all.find((b) => b.id === bookingId && b.category === "kurz");
  if (!booking) return NextResponse.json({ error: "kurz nenalezen" }, { status: 404 });

  const signup: CourseSignup = {
    id: crypto.randomUUID(),
    bookingId,
    name,
    contact,
    people: people ? Math.max(1, Number(people)) : 1,
    note,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  await signupStore.add(signup);

  await Promise.all([sendAdminNewSignupEmail(booking, signup), sendSignupReceivedEmail(booking, signup)]);

  return NextResponse.json(signup, { status: 201 });
}

// GET /api/signups — adminům seznam všech přihlášek (pro admin frontu ke schválení).
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const all = await signupStore.all();
  return NextResponse.json(all);
}
