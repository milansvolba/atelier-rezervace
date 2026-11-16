import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, sameOriginOk } from "@/lib/auth";
import { promoStore, PROMO_MAX_BATCH, PROMO_MIN_FIXED_PRICE, type PromoKind, type PromoScope } from "@/lib/promo";
import { store } from "@/lib/data";

export const dynamic = "force-dynamic";

// GET /api/admin/promo — seznam všech slevových kódů (jen správce).
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Přístup jen pro správce." }, { status: 403 });
  return NextResponse.json(await promoStore.all());
}

// POST /api/admin/promo — vytvoří dávku jedinečných kódů.
// Tělo: { count, kind: "percent"|"fixed_price", value, scope: "kurz"|"poukaz"|"oboje", expiresOn: "YYYY-MM-DD", label?, bookingId? }
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Přístup jen pro správce." }, { status: 403 });
  if (!sameOriginOk(req)) return NextResponse.json({ error: "Požadavek z cizího původu." }, { status: 403 });
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 });

  const count = Math.floor(Number(b.count));
  if (!Number.isFinite(count) || count < 1 || count > PROMO_MAX_BATCH) {
    return NextResponse.json({ error: "Počet kódů musí být 1 až " + PROMO_MAX_BATCH + "." }, { status: 400 });
  }
  const kind: PromoKind | null = b.kind === "percent" || b.kind === "fixed_price" ? b.kind : null;
  if (!kind) return NextResponse.json({ error: "Zvolte typ slevy." }, { status: 400 });
  const value = Math.floor(Number(b.value));
  if (kind === "percent" && !(value >= 1 && value <= 100)) {
    return NextResponse.json({ error: "Sleva v procentech musí být 1 až 100." }, { status: 400 });
  }
  if (kind === "fixed_price" && !(value >= PROMO_MIN_FIXED_PRICE && value <= 100000)) {
    return NextResponse.json({ error: "Výsledná cena musí být aspoň " + PROMO_MIN_FIXED_PRICE + " Kč (minimum platby kartou)." }, { status: 400 });
  }
  const scope: PromoScope | null = b.scope === "kurz" || b.scope === "poukaz" || b.scope === "oboje" ? b.scope : null;
  if (!scope) return NextResponse.json({ error: "Zvolte, kde kód platí." }, { status: 400 });
  // Platnost do konce zadaného dne (středoevropský čas, zjednodušeně 23:59 UTC+1).
  if (typeof b.expiresOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.expiresOn)) {
    return NextResponse.json({ error: "Zadejte platnost kódu (datum)." }, { status: 400 });
  }
  const expiresAt = new Date(b.expiresOn + "T22:59:59Z");
  if (isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Platnost kódu musí být v budoucnosti." }, { status: 400 });
  }
  let bookingId: string | null = null;
  if (typeof b.bookingId === "string" && b.bookingId.trim()) {
    const booking = (await store.all()).find((x) => x.id === b.bookingId && x.category === "kurz");
    if (!booking) return NextResponse.json({ error: "Zvolený termín kurzu neexistuje." }, { status: 400 });
    if (scope === "poukaz") return NextResponse.json({ error: "Kód omezený na termín nemůže platit pro poukaz." }, { status: 400 });
    bookingId = booking.id;
  }
  const maxPeople = b.maxPeople === undefined ? 1 : Math.floor(Number(b.maxPeople));
  if (!(maxPeople >= 1 && maxPeople <= 6)) return NextResponse.json({ error: "Nejvýš míst na kód musí být 1 až 6." }, { status: 400 });
  const label = typeof b.label === "string" ? b.label.trim().slice(0, 80) : "";
  const created = await promoStore.createBatch({ count, kind, value, scope, bookingId, label: label || undefined, maxPeople, expiresAt });
  return NextResponse.json(created, { status: 201 });
}

// PATCH /api/admin/promo — zruší nepoužité kódy. Tělo: { ids: string[] }. Použité kódy zrušit nejde.
export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Přístup jen pro správce." }, { status: 403 });
  if (!sameOriginOk(req)) return NextResponse.json({ error: "Požadavek z cizího původu." }, { status: 403 });
  const b = await req.json().catch(() => null);
  const ids: string[] = Array.isArray(b?.ids) ? b.ids.filter((x: unknown) => typeof x === "string").slice(0, 500) : [];
  if (ids.length === 0) return NextResponse.json({ error: "Nic k zrušení." }, { status: 400 });
  const r = await promoStore.voidCodes(ids);
  if (r.voided === 0 && r.skipped > 0) {
    return NextResponse.json({ error: "Kód se nepodařilo zrušit: platba s ním už probíhá nebo je zaplacená.", ...r }, { status: 409 });
  }
  return NextResponse.json(r);
}
