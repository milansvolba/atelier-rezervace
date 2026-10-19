import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { voucherStore } from "@/lib/vouchers";

export const dynamic = "force-dynamic";

// PATCH /api/vouchers/:id — admin označí poukaz jako uplatněný (např. na místě) nebo ho vrátí do stavu aktivní.
// Tělo: { status: "redeemed" | "active" }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { status } = await req.json().catch(() => ({}));
  if (status !== "redeemed" && status !== "active") return NextResponse.json({ error: "neplatný stav" }, { status: 400 });
  const v = await voucherStore.setStatus(params.id, status);
  if (!v) return NextResponse.json({ error: "poukaz nenalezen" }, { status: 404 });
  return NextResponse.json(v);
}
