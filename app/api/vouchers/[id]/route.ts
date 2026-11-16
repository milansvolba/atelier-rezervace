import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { store } from "@/lib/data";
import { voucherStore } from "@/lib/vouchers";
import { sendVoucherEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// PATCH /api/vouchers/:id — admin označí poukaz jako uplatněný (např. na místě) nebo ho vrátí do stavu aktivní.
// Tělo: { status: "redeemed" | "active" }
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { status } = await req.json().catch(() => ({}));
  if (status !== "redeemed" && status !== "active") return NextResponse.json({ error: "neplatný stav" }, { status: 400 });
  const v = await voucherStore.setStatus(params.id, status);
  if (!v) return NextResponse.json({ error: "poukaz nenalezen" }, { status: 404 });
  return NextResponse.json(v);
}

// POST /api/vouchers/:id — admin pošle kupujícímu e-mail s poukazem (včetně PDF v příloze) znovu.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const v = await voucherStore.byId(params.id);
  if (!v) return NextResponse.json({ error: "poukaz nenalezen" }, { status: 404 });
  const booking = v.bookingId ? (await store.all()).find((b) => b.id === v.bookingId) : undefined;
  await sendVoucherEmail(v, booking);
  return NextResponse.json({ ok: true });
}
