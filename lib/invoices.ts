import { sql, ensureSchema } from "./db";
import type { BillingInput } from "./billingInput";

// Podklady pro daňové doklady. Doklad vystavuje Milan ručně v Caflou; aplikace po zaplacení uloží
// fakturační údaje ze Stripe Checkout a hlídá, co ještě není vystavené. Data jsou v tabulce `payments`
// (jeden řádek na Stripe session, pokrývá kurzy i poukazy).

export const VAT_RATE = 21; // % — ceny jsou vč. DPH
export const INVOICE_OVERDUE_DAYS = 5; // po kolika dnech se nevystavený doklad zvýrazní (upřesní účetní)

export interface BillingDetails {
  name: string; // jméno z platby (držitel karty / kontaktní osoba)
  company?: string; // název firmy, když zákazník zaškrtl „Nakupuji na firmu“
  ico?: string; // z nepovinného pole IČO v Checkoutu
  email: string;
  phone?: string;
  address: { line1?: string; line2?: string; city?: string; postalCode?: string; country?: string };
  taxIds: { type: string; value: string }[]; // např. { type: "eu_vat", value: "CZ12345678" }
}

export type InvoiceKind = "kurz" | "poukaz";

export interface InvoiceItem {
  id: string; // Stripe session
  kind: InvoiceKind;
  description: string;
  amountCzk: number;
  baseCzk: number;
  vatCzk: number;
  paidAt: string;
  billing: BillingDetails | null;
  status: "pending" | "issued";
  invoiceNumber?: string;
  issuedAt?: string;
  correctionNeeded: boolean;
  refundedCzk: number;
  overdue: boolean;
}

// Rozpad ceny vč. DPH na základ a daň (zaokrouhleno na haléře, součet vždy sedí).
export function vatBreakdown(amountCzk: number, rate = VAT_RATE): { base: number; vat: number } {
  const base = Math.round((amountCzk / (1 + rate / 100)) * 100) / 100;
  const vat = Math.round((amountCzk - base) * 100) / 100;
  return { base, vat };
}

// Vytáhne fakturační údaje z objektu Stripe Checkout Session (customer_details).
export function billingFromSession(obj: Record<string, unknown>): BillingDetails {
  const d = (obj.customer_details ?? {}) as {
    name?: string | null;
    business_name?: string | null;
    individual_name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: { line1?: string | null; line2?: string | null; city?: string | null; postal_code?: string | null; country?: string | null } | null;
    tax_ids?: { type?: string; value?: string }[] | null;
  };
  const a = d.address ?? {};
  const fields = (obj.custom_fields ?? []) as { key?: string; text?: { value?: string | null } | null }[];
  const ico = fields.find((f) => f.key === "ico")?.text?.value?.replace(/\s+/g, "") || undefined;
  const company = d.business_name?.trim() || undefined;
  return {
    name: (company ? d.individual_name || d.name : d.name) ?? "",
    company,
    ico,
    email: d.email ?? "",
    phone: d.phone ?? undefined,
    address: {
      line1: a.line1 ?? undefined,
      line2: a.line2 ?? undefined,
      city: a.city ?? undefined,
      postalCode: a.postal_code ?? undefined,
      country: a.country ?? undefined,
    },
    taxIds: (d.tax_ids ?? []).filter((t) => t.value).map((t) => ({ type: t.type ?? "", value: t.value ?? "" })),
  };
}

// Údaje ze formuláře (BillingInput) mají přednost před tím, co o zákazníkovi ví Stripe; Stripe slouží jako záloha.
export function mergeBilling(stripe: BillingDetails, input: BillingInput | null, contactName?: string): BillingDetails {
  if (!input) return contactName ? { ...stripe, name: contactName } : stripe;
  const address = { line1: input.street, city: input.city, postalCode: input.zip, country: "CZ" };
  if (input.isCompany) {
    return {
      ...stripe,
      name: contactName || stripe.name,
      company: input.company,
      ico: input.ico,
      address,
      taxIds: input.dic ? [{ type: "eu_vat", value: input.dic }] : [],
    };
  }
  return { ...stripe, name: contactName || stripe.name, company: undefined, ico: undefined, address, taxIds: [] };
}

function rowToItem(r: Record<string, unknown>): InvoiceItem {
  const amountCzk = Number(r.amount_czk ?? 0);
  const { base, vat } = vatBreakdown(amountCzk);
  const paidAt = r.paid_at ? (typeof r.paid_at === "string" ? r.paid_at : (r.paid_at as Date).toISOString()) : "";
  const status = r.invoice_status === "issued" ? "issued" : "pending";
  let billing: BillingDetails | null = null;
  try {
    billing = r.billing ? (JSON.parse(r.billing as string) as BillingDetails) : null;
  } catch {
    billing = null;
  }
  const ageDays = paidAt ? (Date.now() - new Date(paidAt).getTime()) / 86400000 : 0;
  return {
    id: r.id as string,
    kind: (r.kind as InvoiceKind) ?? "kurz",
    description: (r.description as string) ?? "",
    amountCzk,
    baseCzk: base,
    vatCzk: vat,
    paidAt,
    billing,
    status,
    invoiceNumber: (r.invoice_number as string) ?? undefined,
    issuedAt: r.invoice_issued_at ? (typeof r.invoice_issued_at === "string" ? r.invoice_issued_at : (r.invoice_issued_at as Date).toISOString()) : undefined,
    correctionNeeded: Boolean(r.correction_needed),
    refundedCzk: Number(r.refunded_czk ?? 0),
    overdue: status === "pending" && ageDays > INVOICE_OVERDUE_DAYS,
  };
}

export const invoiceStore = {
  // Po zaplacení: uloží údaje k řádku payments (ten už vytvořil markPaid) a vrátí hotovou položku.
  async record(sessionId: string, d: { kind: InvoiceKind; description: string; amountCzk: number; billing: BillingDetails; contactName?: string }): Promise<InvoiceItem | null> {
    await ensureSchema();
    const pre = await sql`SELECT billing_input FROM payments WHERE id = ${sessionId}`;
    let input: BillingInput | null = null;
    try {
      input = pre[0]?.billing_input ? (JSON.parse(pre[0].billing_input as string) as BillingInput) : null;
    } catch {
      input = null;
    }
    d = { ...d, billing: mergeBilling(d.billing, input, d.contactName) };
    const rows = await sql`
      UPDATE payments SET kind = ${d.kind}, description = ${d.description}, billing = ${JSON.stringify(d.billing)},
        amount_czk = ${Math.round(d.amountCzk)}, paid_at = COALESCE(paid_at, now()), invoice_status = COALESCE(invoice_status, 'pending')
      WHERE id = ${sessionId}
      RETURNING *
    `;
    return rows[0] ? rowToItem(rows[0]) : null;
  },

  // Fronta: nevystavené doklady + vystavené, u kterých po vratce chybí opravný doklad; k tomu posledních 15 vystavených.
  async list(): Promise<{ open: InvoiceItem[]; done: InvoiceItem[] }> {
    await ensureSchema();
    const open = await sql`
      SELECT * FROM payments WHERE status = 'paid' AND kind IS NOT NULL AND (invoice_status = 'pending' OR correction_needed)
      ORDER BY paid_at ASC
    `;
    const done = await sql`
      SELECT * FROM payments WHERE status = 'paid' AND kind IS NOT NULL AND invoice_status = 'issued' AND NOT correction_needed
      ORDER BY invoice_issued_at DESC NULLS LAST LIMIT 15
    `;
    return { open: open.map(rowToItem), done: done.map(rowToItem) };
  },

  async markIssued(id: string, number?: string): Promise<void> {
    await ensureSchema();
    await sql`UPDATE payments SET invoice_status = 'issued', invoice_number = ${number?.trim() || null}, invoice_issued_at = now() WHERE id = ${id}`;
  },

  async reopen(id: string): Promise<void> {
    await ensureSchema();
    await sql`UPDATE payments SET invoice_status = 'pending', invoice_issued_at = NULL WHERE id = ${id}`;
  },

  async correctionDone(id: string): Promise<void> {
    await ensureSchema();
    await sql`UPDATE payments SET correction_needed = false WHERE id = ${id}`;
  },

  async openCount(): Promise<number> {
    await ensureSchema();
    const rows = await sql`SELECT COUNT(*) AS n FROM payments WHERE status = 'paid' AND kind IS NOT NULL AND (invoice_status = 'pending' OR correction_needed)`;
    return Number(rows[0]?.n ?? 0);
  },
};
