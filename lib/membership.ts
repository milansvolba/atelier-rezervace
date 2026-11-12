import { users, AppUser, MembershipStatus } from "./users";
import { invoiceStore } from "./invoices";
import { sendAdminInvoiceBasisEmail, sendMembershipAccessEmail, sendMembershipCancelledEmail, membershipLoginLink } from "./email";

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
    success_url: appUrl() + "/clenstvi?platba=ok",
    cancel_url: appUrl() + "/clenstvi?platba=zrusena",
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

const cz = (ts: number) => new Date(ts * 1000).toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague" }).replace(/\u00a0/g, " ");

// Uvítací e-mail s přístupem (e-mail 2) se po první zaplacené platbě pošle právě jednou. Zkouší se z obou událostí
// Stripe (invoice.paid i checkout.session.completed), protože chodí v libovolném pořadí. Která dřív najde člena, ta e-mail pošle.
async function sendWelcomeAfterPaymentOnce(user: AppUser | null) {
  if (!user || user.membershipFree) return;
  if (!(await users.claimWelcomeSent(user.id))) return;
  try {
    await sendMembershipAccessEmail(user, await membershipLoginLink(user.email));
  } catch (e) {
    console.error("[stripe] Uvítací e-mail po platbě se nepodařilo odeslat:", e);
  }
}

// Z faktury Stripe (invoice.paid) vytvoří položku fronty dokladů. Nulové faktury (kupón, zkušební doba) se přeskočí.
async function queueMembershipInvoice(o: Record<string, unknown>, user: AppUser | null) {
  const invoiceId = str(o.id);
  const amountHal = typeof o.amount_paid === "number" ? o.amount_paid : 0;
  if (!invoiceId || amountHal <= 0) return;
  const lines = (o.lines as { data?: Array<{ period?: { start?: number; end?: number } }> } | undefined)?.data;
  const period = lines?.[0]?.period;
  const range = period?.start && period?.end ? ", " + cz(period.start) + " – " + cz(period.end - 1) : "";
  const addr = (o.customer_address ?? {}) as { line1?: string; line2?: string; city?: string; postal_code?: string; country?: string };
  const paidTs = (o.status_transitions as { paid_at?: number } | undefined)?.paid_at;
  const item = await invoiceStore.recordMembership(invoiceId, {
    description: "Členství v klubu" + range,
    amountHal,
    paidAt: paidTs ? new Date(paidTs * 1000).toISOString() : undefined,
    billing: {
      name: str(o.customer_name) || user?.name || "",
      email: str(o.customer_email) || user?.email || "",
      address: { line1: addr.line1, line2: addr.line2, city: addr.city, postalCode: addr.postal_code, country: addr.country },
      taxIds: [],
    },
  });
  if (item) await sendAdminInvoiceBasisEmail(item);
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
      // Může přijít dřív než invoice.paid i později. Uvítání po platbě se pošle jen jednou a jen když je platba hotová.
      if (o.payment_status === "paid") await sendWelcomeAfterPaymentOnce(await users.byId(userId));
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
    // Ruční fakturace v Caflou: každá zaplacená faktura předplatného (i první) založí podklad ve frontě
    // „Doklad k vystavení“ a pošle e-mail Milanovi. Chyba tady nesmí shodit webhook (stav členství už je uložen).
    if (event.type === "invoice.paid") {
      // Uvítací e-mail s přístupem do ateliéru: jen po první zaplacené platbě (jednou).
      await sendWelcomeAfterPaymentOnce(user);
      try {
        await queueMembershipInvoice(o, user);
      } catch (e) {
        console.error("[stripe] Podklad k dokladu za členství (faktura " + String(o.id) + ") se nepodařilo uložit:", e);
      }
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
      if (endTs) {
        // První zaznamenané zrušení: členovi pošleme e-mail (jednou), další události Stripe už ne.
        const isNew = await users.setMembershipEndIfNew(user.id, new Date(endTs * 1000).toISOString());
        if (isNew) {
          try {
            await sendMembershipCancelledEmail(user, cz(endTs));
          } catch (e) {
            console.error("[stripe] E-mail o zrušení členství se nepodařilo odeslat:", e);
          }
        }
      } else {
        await users.setMembershipEnd(user.id, null);
      }
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
