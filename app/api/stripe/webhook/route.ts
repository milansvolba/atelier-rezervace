import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/data";
import { signupStore } from "@/lib/signups";
import { CourseSignup } from "@/lib/types";
import { verifyStripeSignature, paymentStore } from "@/lib/stripe";
import { handleMembershipEvent } from "@/lib/membership";
import { handleVoucherPaid } from "@/lib/vouchers";
import { invoiceStore, billingFromSession } from "@/lib/invoices";
import { czDate } from "@/lib/invoiceFormat";
import { sendAdminNewSignupEmail, sendSignupDecisionEmail, sendVoucherEmail, sendAdminNewVoucherEmail, sendAdminInvoiceBasisEmail, sendDokladNoteEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// POST /api/stripe/webhook — Stripe sem posílá události o platbách.
// Podpis se ověřuje přes STRIPE_WEBHOOK_SECRET (viz lib/stripe.ts). Po zaplacení se vytvoří
// POTVRZENÁ přihláška na kurz (bez ručního schvalování), adminům i zákazníkovi odejde e-mail.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "webhook není nastavený" }, { status: 503 });
  if (!verifyStripeSignature(raw, req.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "neplatný podpis" }, { status: 400 });
  }

  const event = JSON.parse(raw) as { type: string; data: { object: Record<string, unknown> } };
  const obj = event.data.object;
  const sessionId = String(obj.id ?? "");
  const meta = (obj.metadata ?? {}) as Record<string, string>;

  // Členství (předplatné): checkout.session.completed v režimu subscription, invoice.paid / payment_failed,
  // customer.subscription.deleted — řeší lib/membership.ts, zbytek jde dál do plateb za kurzy.
  if (await handleMembershipEvent(event)) return NextResponse.json({ received: true });

  // Dárkový poukaz (metadata kind=voucher z /api/vouchers/checkout): po zaplacení vznikne poukaz s kódem
  // (u pevného termínu i potvrzená přihláška). MUSÍ být před větví plateb za kurzy níže, ta by ho jinak
  // vzala jako běžnou přihlášku. Při skutečné chybě (výjimka) vrátí webhook 500 a Stripe událost zopakuje.
  if (event.type === "checkout.session.completed" && obj.payment_status === "paid" && meta.kind === "voucher") {
    const result = await handleVoucherPaid(sessionId, obj);
    if (result) {
      await Promise.all([
        sendVoucherEmail(result.voucher, result.booking),
        sendAdminNewVoucherEmail(result.voucher, { booking: result.booking, overbooked: result.overbooked, signupFailed: result.signupFailed }),
      ]);
      await queueInvoice(sessionId, obj, meta.buyerName, "poukaz", "Dárkový poukaz " + result.voucher.code + " – " + result.voucher.courseTitle);
    }
    return NextResponse.json({ received: true });
  }

  // Platební stránka vypršela bez zaplacení — uvolní se držená místa.
  if (event.type === "checkout.session.expired") {
    await paymentStore.markExpired(sessionId);
    return NextResponse.json({ received: true });
  }

  if (event.type === "checkout.session.completed" && obj.payment_status === "paid") {
    const bookingId = meta.bookingId;
    const people = Math.max(1, Number(meta.people) || 1);
    if (!bookingId) {
      console.error("[stripe] Zaplacená session " + sessionId + " bez bookingId v metadatech.");
      return NextResponse.json({ received: true });
    }

    // true jen poprvé — Stripe může stejnou událost doručit opakovaně.
    const first = await paymentStore.markPaid(sessionId, bookingId, people);
    if (first) {
      const booking = (await store.all()).find((b) => b.id === bookingId && b.category === "kurz");
      if (booking) {
        const details = (obj.customer_details ?? {}) as { email?: string };
        const amount = Number(obj.amount_total ?? 0) / 100;
        let contact = meta.contact || "";
        let note = "Zaplaceno online (" + amount + " Kč" + (Number(meta.casting) > 0 ? ", vč. " + meta.casting + "× betonový odlitek" : "") + ")." + (meta.note ? " " + meta.note : "");
        // Když zákazník zadal telefon, e-mail na potvrzení vezmeme z platební stránky.
        if (!contact.includes("@") && details.email) {
          note = "Kontakt zadaný v přihlášce: " + contact + ". " + note;
          contact = details.email;
        }
        const signup: CourseSignup = {
          id: crypto.randomUUID(),
          bookingId,
          name: meta.name || "",
          contact,
          people,
          note,
          status: "confirmed",
          createdAt: new Date().toISOString(),
          heardAbout: meta.heardAbout?.trim() || undefined,
        };
        await signupStore.add(signup);
        try {
          await paymentStore.attach(sessionId, { paymentIntent: typeof obj.payment_intent === "string" ? obj.payment_intent : undefined, amountCzk: amount, signupId: signup.id });
        } catch (e) {
          console.error("[stripe] Nepodařilo se spojit platbu " + sessionId + " s přihláškou:", e);
        }
        await Promise.all([sendAdminNewSignupEmail(booking, signup), sendSignupDecisionEmail(booking, signup, true)]);
        if (contact.includes("@")) await sendDokladNoteEmail(contact, signup.id, booking.id);
        await queueInvoice(sessionId, obj, meta.name, "kurz", "Kurz " + booking.title + " " + czDate(booking.date) + ", " + people + " os.");
      } else {
        console.error("[stripe] Zaplacená session " + sessionId + ": kurz " + bookingId + " už neexistuje.");
      }
    }
  }

  return NextResponse.json({ received: true });
}

// Uloží podklady pro daňový doklad a pošle je adminům. Chyba tady nesmí shodit webhook
// (přihláška/poukaz už vznikly, Stripe by událost zbytečně opakoval).
async function queueInvoice(sessionId: string, obj: Record<string, unknown>, contactName: string | undefined, kind: "kurz" | "poukaz", description: string) {
  try {
    const item = await invoiceStore.record(sessionId, {
      kind,
      description,
      amountCzk: Number(obj.amount_total ?? 0) / 100,
      billing: billingFromSession(obj),
      contactName: contactName?.trim() || undefined,
    });
    if (item) await sendAdminInvoiceBasisEmail(item);
  } catch (e) {
    console.error("[stripe] Podklady pro doklad k " + sessionId + " se nepodařilo uložit:", e);
  }
}
