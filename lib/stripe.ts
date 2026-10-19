import crypto from "crypto";
import { sql, ensureSchema } from "./db";

// Stripe přes REST API (fetch) — záměrně bez npm balíčku "stripe", aby šlo appku
// upravovat jen přes web GitHubu bez aktualizace package-lock.json.

const STRIPE_API = "https://api.stripe.com/v1";

// Online lze zaplatit nejvýš tolik míst najednou; větší skupiny jdou přes poptávku (ruční schválení).
export const MAX_ONLINE_SEATS = 6;

function form(params: Record<string, string | number | undefined>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(String(v)))
    .join("&");
}

export interface CheckoutInput {
  amountCzk: number;
  productName: string;
  customerEmail?: string;
  extraItems?: { name: string; amountCzk: number; quantity: number }[]; // další položky (např. odlitek)
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
}

// Vytvoří Stripe Checkout Session (hostovaná platební stránka). Session vyprší za ~31 minut.
export async function createCheckoutSession(input: CheckoutInput): Promise<{ id: string; url: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Chybí STRIPE_SECRET_KEY");
  const params: Record<string, string | number | undefined> = {
    mode: "payment",
    locale: "cs",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
    customer_email: input.customerEmail,
    "line_items[0][quantity]": 1,
    "line_items[0][price_data][currency]": "czk",
    "line_items[0][price_data][unit_amount]": Math.round(input.amountCzk * 100),
    "line_items[0][price_data][product_data][name]": input.productName,
  };
  // DPH: sazba (21 % vč. DPH) z proměnné STRIPE_TAX_RATE_ID, ať se na dokladu rozepíše.
  if (process.env.STRIPE_TAX_RATE_ID) params["line_items[0][tax_rates][0]"] = process.env.STRIPE_TAX_RATE_ID;
  (input.extraItems ?? []).forEach((it, idx) => {
    const n = idx + 1;
    params["line_items[" + n + "][quantity]"] = it.quantity;
    params["line_items[" + n + "][price_data][currency]"] = "czk";
    params["line_items[" + n + "][price_data][unit_amount]"] = Math.round(it.amountCzk * 100);
    params["line_items[" + n + "][price_data][product_data][name]"] = it.name;
    if (process.env.STRIPE_TAX_RATE_ID) params["line_items[" + n + "][tax_rates][0]"] = process.env.STRIPE_TAX_RATE_ID;
  });
  for (const [k, v] of Object.entries(input.metadata)) params["metadata[" + k + "]"] = v;
  const res = await fetch(STRIPE_API + "/checkout/sessions", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/x-www-form-urlencoded" },
    body: form(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error("Stripe: " + (data?.error?.message ?? res.status));
  return { id: data.id as string, url: data.url as string };
}

// Ověří podpis webhooku (hlavička Stripe-Signature: t=...,v1=...) přes HMAC-SHA256.
export function verifyStripeSignature(rawBody: string, header: string | null, secret: string, toleranceSec = 300): boolean {
  if (!header) return false;
  let t = "";
  const sigs: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=");
    if (k === "t") t = v;
    if (k === "v1") sigs.push(v);
  }
  if (!t || sigs.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > toleranceSec) return false;
  const expected = crypto.createHmac("sha256", secret).update(t + "." + rawBody).digest("hex");
  return sigs.some((s) => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}

// Evidence plateb — drží místa během platby a zajišťuje idempotenci webhooku.
// Hold trvá 35 minut (Checkout Session vyprší dřív, za ~31 minut).
export const paymentStore = {
  async addAwaiting(sessionId: string, bookingId: string, people: number): Promise<void> {
    await ensureSchema();
    await sql`INSERT INTO payments (id, booking_id, people, status) VALUES (${sessionId}, ${bookingId}, ${people}, 'awaiting') ON CONFLICT (id) DO NOTHING`;
  },

  // Počet míst, která jsou právě držená rozpracovanou platbou.
  async heldPeople(bookingId: string): Promise<number> {
    await ensureSchema();
    const rows = await sql`
      SELECT COALESCE(SUM(people), 0) AS total FROM payments
      WHERE booking_id = ${bookingId} AND status = 'awaiting' AND created_at > now() - interval '35 minutes'
    `;
    return Number(rows[0]?.total ?? 0);
  },

  // Vrátí true jen poprvé pro danou session (Stripe může stejnou událost poslat opakovaně).
  async markPaid(sessionId: string, bookingId: string, people: number): Promise<boolean> {
    await ensureSchema();
    const rows = await sql`
      INSERT INTO payments (id, booking_id, people, status) VALUES (${sessionId}, ${bookingId}, ${people}, 'paid')
      ON CONFLICT (id) DO UPDATE SET status = 'paid' WHERE payments.status <> 'paid'
      RETURNING id
    `;
    return rows.length > 0;
  },

  // Po vytvoření přihlášky uloží k platbě payment_intent, částku a ID přihlášky (pro pozdější storno/vratku).
  async attach(sessionId: string, d: { paymentIntent?: string; amountCzk: number; signupId: string }): Promise<void> {
    await ensureSchema();
    await sql`UPDATE payments SET payment_intent = ${d.paymentIntent ?? null}, amount_czk = ${Math.round(d.amountCzk)}, signup_id = ${d.signupId} WHERE id = ${sessionId}`;
  },

  async bySignup(signupId: string): Promise<{ id: string; paymentIntent: string | null; amountCzk: number; refundedCzk: number } | null> {
    await ensureSchema();
    const rows = await sql`SELECT id, payment_intent, amount_czk, refunded_czk FROM payments WHERE signup_id = ${signupId} AND status = 'paid' LIMIT 1`;
    if (!rows[0]) return null;
    return {
      id: rows[0].id as string,
      paymentIntent: (rows[0].payment_intent as string) ?? null,
      amountCzk: Number(rows[0].amount_czk ?? 0),
      refundedCzk: Number(rows[0].refunded_czk ?? 0),
    };
  },

  async addRefunded(sessionId: string, czk: number): Promise<void> {
    await ensureSchema();
    await sql`UPDATE payments SET refunded_czk = refunded_czk + ${Math.round(czk)} WHERE id = ${sessionId}`;
  },

  async markExpired(sessionId: string): Promise<void> {
    await ensureSchema();
    await sql`UPDATE payments SET status = 'expired' WHERE id = ${sessionId} AND status = 'awaiting'`;
  },
};


// Vrácení části nebo celé platby přes Stripe Refunds API (částka v Kč).
export async function createRefund(paymentIntent: string, amountCzk: number): Promise<{ id: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Chybí STRIPE_SECRET_KEY");
  const res = await fetch(STRIPE_API + "/refunds", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ payment_intent: paymentIntent, amount: Math.round(amountCzk * 100) }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error("Stripe: " + (data?.error?.message ?? res.status));
  return { id: data.id as string };
}
