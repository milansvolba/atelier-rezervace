import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/data";
import { signupStore } from "@/lib/signups";
import { voucherStore } from "@/lib/vouchers";
import { cleanPhone, validEmail } from "@/lib/signupContact";
import { sendAdminVoucherContactEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Doplnění kontaktu na obdarovaného u poukazu s pevným termínem. Bez přihlášení, podle tajného tokenu
// z e-mailu s poukazem (ne podle kódu poukazu, ten se předává dál). Poukaz musí být aktivní a mít termín.

async function loadVoucher(token: string) {
  const v = await voucherStore.byManageToken(token);
  if (!v || !v.bookingId) return null;
  const booking = (await store.all()).find((b) => b.id === v.bookingId);
  return { v, booking };
}

// GET /api/vouchers/contact?t=TOKEN — co se ukáže ve formuláři (kurz, termín, uložený kontakt).
export async function GET(req: NextRequest) {
  const found = await loadVoucher(req.nextUrl.searchParams.get("t") ?? "");
  if (!found) return NextResponse.json({ error: "Odkaz není platný." }, { status: 404 });
  const { v, booking } = found;
  return NextResponse.json({
    courseTitle: v.courseTitle,
    date: booking?.date ?? null,
    startTime: booking?.startTime ?? null,
    endTime: booking?.endTime ?? null,
    recipientName: v.recipientName ?? "",
    recipientEmail: v.recipientEmail ?? "",
    recipientPhone: v.recipientPhone ?? "",
  });
}

// POST /api/vouchers/contact — tělo: { t, recipientName?, recipientEmail?, recipientPhone? }; aspoň e-mail nebo telefon.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const found = await loadVoucher(String(body.t ?? ""));
  if (!found) return NextResponse.json({ error: "Odkaz není platný." }, { status: 404 });
  const { v, booking } = found;

  const email = String(body.recipientEmail ?? "").trim();
  const phoneRaw = String(body.recipientPhone ?? "").trim();
  const name = String(body.recipientName ?? "").trim().slice(0, 100);
  if (!email && !phoneRaw) return NextResponse.json({ error: "Vyplňte prosím e-mail nebo telefon obdarovaného." }, { status: 400 });
  if (email && !validEmail(email)) return NextResponse.json({ error: "E-mail nevypadá správně." }, { status: 400 });
  const phone = phoneRaw ? cleanPhone(phoneRaw) : null;
  if (phoneRaw && !phone) return NextResponse.json({ error: "Telefon nevypadá správně." }, { status: 400 });

  const updated = await voucherStore.setRecipientContact(v.id, {
    recipientName: name || v.recipientName,
    recipientEmail: email || undefined,
    recipientPhone: phone || undefined,
  });
  if (!updated) return NextResponse.json({ error: "Poukaz nenalezen." }, { status: 404 });

  // Přihláška na termínu: volat se bude obdarovanému (jinak kupujícímu), změny termínu jdou obdarovanému, když má e-mail.
  if (v.signupId) {
    await signupStore.updateContact(v.signupId, {
      phone: updated.recipientPhone || updated.buyerPhone,
      notifyEmail: updated.recipientEmail,
    });
  }
  await sendAdminVoucherContactEmail(updated, booking).catch(() => {});
  return NextResponse.json({ ok: true });
}
