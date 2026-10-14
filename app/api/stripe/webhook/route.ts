import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/data";
import { signupStore } from "@/lib/signups";
import { CourseSignup } from "@/lib/types";
import { verifyStripeSignature, paymentStore } from "@/lib/stripe";
import { sendAdminNewSignupEmail, sendSignupDecisionEmail } from "@/lib/email";

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
        let note = "Zaplaceno online (" + amount + " Kč)." + (meta.note ? " " + meta.note : "");
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
        };
        await signupStore.add(signup);
        await Promise.all([sendAdminNewSignupEmail(booking, signup), sendSignupDecisionEmail(booking, signup, true)]);
      } else {
        console.error("[stripe] Zaplacená session " + sessionId + ": kurz " + bookingId + " už neexistuje.");
      }
    }
  }

  return NextResponse.json({ received: true });
}
