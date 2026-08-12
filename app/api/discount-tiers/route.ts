import { NextRequest, NextResponse } from "next/server";
import { discountStore, DiscountTier } from "@/lib/discounts";
import { requireAdmin } from "@/lib/auth";

// GET /api/discount-tiers -- verejny seznam slevovych tieru (pro vypocet ceny na webu i v aplikaci).
export async function GET() {
  const tiers = await discountStore.all();
  return NextResponse.json(tiers);
}

// POST /api/discount-tiers -- admin vytvori nebo upravi tier (upsert podle id).
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const { id, minFillPercent, discountPercent, sortOrder } = body;
  if (minFillPercent == null || discountPercent == null) {
    return NextResponse.json({ error: "chybi povinne udaje" }, { status: 400 });
  }
  const tier: DiscountTier = {
    id: id || crypto.randomUUID(),
    minFillPercent: Number(minFillPercent),
    discountPercent: Number(discountPercent),
    sortOrder: sortOrder != null ? Number(sortOrder) : 0,
  };
  const saved = await discountStore.upsert(tier);
  return NextResponse.json(saved, { status: 201 });
}

// DELETE /api/discount-tiers -- admin smaze tier podle id v query parametru.
export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "chybi id" }, { status: 400 });
  await discountStore.remove(id);
  return NextResponse.json({ ok: true });
}
