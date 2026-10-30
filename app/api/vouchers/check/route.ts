import { NextRequest, NextResponse } from "next/server";
import { voucherCourse } from "@/lib/pricing";
import { voucherStore, isExpired } from "@/lib/vouchers";

export const dynamic = "force-dynamic";

// POST /api/vouchers/check — ověří kód poukazu bez vybraného termínu (odkaz z e-mailu: /kurzy?poukaz=KÓD).
// Tělo: { code }. Nic nezapisuje. Vrací počet osob, odlitky a typ kurzu poukazu (klíč), podle kterého se filtrují termíny.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
  const voucher = body.code ? await voucherStore.byCode(String(body.code)) : null;
  // Stejná odpověď pro neexistující kód, aby se kódy nedaly zjišťovat.
  if (!voucher) return bad("Poukaz s tímto kódem jsme nenašli. Zkontrolujte prosím kód.", 404);
  if (voucher.status !== "active") return bad("Tento poukaz už byl uplatněn.", 409);
  if (isExpired(voucher)) return bad("Platnost poukazu vypršela.", 410);
  if (voucher.bookingId) {
    return bad("Tento poukaz už je přiřazen ke konkrétnímu termínu a místo na něm máte potvrzené.", 409);
  }
  const course = voucherCourse(voucher.topic);
  if (!course) return bad("Poukaz se nepodařilo ověřit, napište nám prosím na rezervace@ateliernapobrezi.cz.", 500);
  return NextResponse.json({
    ok: true,
    code: voucher.code,
    people: voucher.people,
    castingCount: voucher.castingCount,
    courseTitle: voucher.courseTitle,
    type: course.key,
  });
}
