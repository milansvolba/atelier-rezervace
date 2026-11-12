import { signupNotifyTo } from "@/lib/signupContact";
import { NextRequest, NextResponse } from "next/server";
import { signupStore } from "@/lib/signups";
import { store } from "@/lib/data";
import { requireAdmin } from "@/lib/auth";
import { paymentStore, createRefund } from "@/lib/stripe";
import { sendSignupCancelledEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Navržená vratka podle dnů do kurzu: 7+ dní 100 %, 3–6 dní 50 %, 0–2 dny 0 %.
function suggestedPercent(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const course = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.floor((course - today) / 86400000);
  return days >= 7 ? 100 : days >= 3 ? 50 : 0;
}

// GET /api/signups/:id/cancel — info pro storno: zaplacená částka, již vráceno, navržená vratka.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const signup = await signupStore.byId(params.id);
  if (!signup) return NextResponse.json({ error: "přihláška nenalezena" }, { status: 404 });
  const booking = (await store.all()).find((b) => b.id === signup.bookingId);
  const pay = await paymentStore.bySignup(signup.id);
  const percent = booking ? suggestedPercent(booking.date) : 0;
  const refundable = pay ? Math.max(0, pay.amountCzk - pay.refundedCzk) : 0;
  const suggested = pay ? Math.min(refundable, Math.round((pay.amountCzk * percent) / 100)) : 0;
  return NextResponse.json({ paid: !!pay && !!pay.paymentIntent, amountCzk: pay?.amountCzk ?? 0, refundedCzk: pay?.refundedCzk ?? 0, refundable, percent, suggested });
}

// POST /api/signups/:id/cancel  { refundCzk: number, notify: boolean }
// Zruší potvrzenou přihlášku (místa se uvolní), případně vrátí část platby přes Stripe a pošle e-mail.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const signup = await signupStore.byId(params.id);
  if (!signup) return NextResponse.json({ error: "přihláška nenalezena" }, { status: 404 });
  if (signup.status === "cancelled") return NextResponse.json({ error: "Přihláška je už stornována." }, { status: 400 });

  const pay = await paymentStore.bySignup(signup.id);
  const wanted = Math.max(0, Math.round(Number(body.refundCzk) || 0));
  if (wanted > 0) {
    if (!pay || !pay.paymentIntent) return NextResponse.json({ error: "K přihlášce není online platba, vratku nelze poslat." }, { status: 400 });
    if (wanted > pay.amountCzk - pay.refundedCzk) return NextResponse.json({ error: "Vratka je vyšší než zaplacená částka." }, { status: 400 });
  }

  // Storno si nejdřív atomicky „zamkneme“: dvojí kliknutí nebo dvě okna nikdy neprojdou obě,
  // takže se vratka pošle nejvýš jednou. Když vratka selže, stav se vrátí zpět.
  const previous = await signupStore.cancelIfActive(params.id);
  if (!previous) return NextResponse.json({ error: "Přihláška je už stornována." }, { status: 400 });

  let refunded = 0;
  if (wanted > 0 && pay && pay.paymentIntent) {
    if (!(await paymentStore.reserveRefund(pay.id, wanted))) {
      await signupStore.updateStatus(params.id, previous);
      return NextResponse.json({ error: "Vratka je vyšší než zaplacená částka." }, { status: 400 });
    }
    try {
      // Klíč je vázaný na přihlášku a částku: opakování téhož požadavku nikdy nevrátí peníze dvakrát.
      await createRefund(pay.paymentIntent, wanted, "cancel-" + signup.id + "-" + wanted);
      await paymentStore.flagCorrection(pay.id);
      refunded = wanted;
    } catch (e) {
      await paymentStore.releaseRefund(pay.id, wanted);
      await signupStore.updateStatus(params.id, previous);
      return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 502 });
    }
  }

  const updated = await signupStore.byId(params.id);
  const booking = (await store.all()).find((b) => b.id === signup.bookingId);
  if (body.notify && booking && updated && signupNotifyTo(updated)) {
    await sendSignupCancelledEmail(booking, updated, refunded);
  }
  return NextResponse.json({ ok: true, refunded });
}
