import { users, AppUser, MembershipStatus } from "./users";

// Členství v klubu = měsíční předplatné ve Stripe (Checkout v režimu "subscription").
// Cena se bere z proměnné STRIPE_MEMBERSHIP_PRICE_ID (ve sandboxu a v ostrém provozu je jiná).
// Faktury s číslem vystavuje Stripe automaticky při každé platbě předplatného.

const API = "https://api.stripe.com/v1";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://rezervace.ateliernapobrezi.cz";
}

async function stripePost(path: string, params: Record<string, string>) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY není nastavený");
  const res = await fetch(API + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Stripe vrátil chybu");
  return data;
}

// Vrátí adresu platební stránky Stripe pro založení předplatného.
export async function createMembershipCheckout(user: AppUser): Promise<string> {
  const price = process.env.STRIPE_MEMBERSHIP_PRICE_ID;
  if (!price) throw new Error("STRIPE_MEMBERSHIP_PRICE_ID není nastavený");
  const params: Record<string, string> = {
    mode: "subscription",
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    success_url: appUrl() + "/admin?clenstvi=ok",
    cancel_url: appUrl() + "/admin?clenstvi=zruseno",
    locale: "cs",
    client_reference_id: user.id,
    "metadata[userId]": user.id,
    "subscription_data[metadata][userId]": user.id,
  };
  // DPH: sazba (21 % vč. DPH) z proměnné STRIPE_TAX_RATE_ID, ať se na faktuře rozepíše.
  if (process.env.STRIPE_TAX_RATE_ID) params["line_items[0][tax_rates][0]"] = process.env.STRIPE_TAX_RATE_ID;
  if (user.stripeCustomerId) params.customer = user.stripeCustomerId;
  else params.customer_email = user.email;
  const session = await stripePost("/checkout/sessions", params);
  return session.url as string;
}

// Zákaznický portál Stripe: změna karty, faktury, zrušení předplatného.
export async function createPortalUrl(customerId: string): Promise<string> {
  const session = await stripePost("/billing_portal/sessions", {
    customer: customerId,
    return_url: appUrl() + "/admin",
  });
  return session.url as string;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

// Zpracuje události Stripe týkající se členství. Vrací true, pokud událost patřila sem
// (a webhook ji už nemá posílat do větve plateb za kurzy).
export async function handleMembershipEvent(event: {
  type: string;
  data: { object: Record<string, unknown> };
}): Promise<boolean> {
  const o = event.data.object;

  if (event.type === "checkout.session.completed" && o.mode === "subscription") {
    const meta = (o.metadata ?? {}) as Record<string, string>;
    const userId = str(o.client_reference_id) || meta.userId;
    if (userId) {
      await users.setMembership(userId, {
        status: "active",
        customerId: str(o.customer),
        subscriptionId: str(o.subscription),
      });
    } else {
      console.error("[stripe] Předplatné bez userId v session " + String(o.id));
    }
    return true;
  }

  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const customerId = str(o.customer);
    const user = customerId ? await users.byStripeCustomer(customerId) : null;
    if (user) {
      const status: MembershipStatus = event.type === "invoice.paid" ? "active" : "past_due";
      await users.setMembership(user.id, { status });
    }
    return true;
  }

  // Zrušené předplatné (portál Stripe) doběhne až ke konci zaplaceného období: uložíme datum konce.
  if (event.type === "customer.subscription.updated") {
    const customerId = str(o.customer);
    const user = customerId ? await users.byStripeCustomer(customerId) : null;
    if (user) {
      const items = o.items as { data?: Array<{ current_period_end?: number }> } | undefined;
      const periodEnd =
        typeof o.current_period_end === "number" ? o.current_period_end : items?.data?.[0]?.current_period_end;
      const cancelAt = typeof o.cancel_at === "number" ? o.cancel_at : undefined;
      const endTs = o.cancel_at_period_end ? cancelAt ?? periodEnd : cancelAt;
      await users.setMembershipEnd(user.id, endTs ? new Date(endTs * 1000).toISOString() : null);
    }
    return true;
  }

  if (event.type === "customer.subscription.deleted") {
    const customerId = str(o.customer);
    const user = customerId ? await users.byStripeCustomer(customerId) : null;
    if (user) {
      await users.setMembership(user.id, { status: "canceled" });
      await users.setMembershipEnd(user.id, null);
    }
    return true;
  }

  return false;
}
