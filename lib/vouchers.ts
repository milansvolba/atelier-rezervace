import crypto from "crypto";
import { sql, ensureSchema } from "./db";
import { store } from "./data";
import { signupStore } from "./signups";
import { courseFlags } from "./courseFlags";
import { paymentStore } from "./stripe";
import { voucherCourse } from "./pricing";
import { castingText } from "./voucherConfig";
import { Booking, CourseSignup } from "./types";

// Dárkové poukazy na kurzy. Tabulka `vouchers` je v lib/db.ts, ceny kurzů (VOUCHER_COURSES) v lib/pricing.ts.
// Poukaz vzniká až po zaplacení (webhook /api/stripe/webhook, větev meta.kind === "voucher").
// Odesílání e-mailů tenhle soubor záměrně nedělá — vrací vytvořená data a e-maily posílá volající (webhook).

export type VoucherStatus = "active" | "redeemed";

export interface Voucher {
  id: string;
  code: string; // ATL-XXXX-XXXX
  topic: string; // klíč kurzu z VOUCHER_COURSES ("hlava" | "relief")
  courseTitle: string;
  bookingId?: string; // pevný termín, pokud ho kupující zvolil
  people: number;
  castingCount: number; // počet betonových odlitků v poukazu (0 až people)
  amountCzk: number;
  buyerName: string;
  buyerEmail: string;
  recipientName?: string;
  message?: string;
  status: VoucherStatus;
  stripeSession?: string;
  createdAt: string;
  expiresAt: string;
  redeemedAt?: string;
}

// Platnost poukazu od zaplacení.
export { VOUCHER_VALID_MONTHS } from "./voucherConfig";
import { VOUCHER_VALID_MONTHS } from "./voucherConfig";

// Zástupné booking_id pro tabulku payments (poukaz nemá termín, sloupec je NOT NULL).
const PAYMENT_REF = "voucher";

function iso(v: unknown): string {
  return typeof v === "string" ? v : (v as Date).toISOString();
}

function rowToVoucher(r: Record<string, unknown>): Voucher {
  return {
    id: r.id as string,
    code: r.code as string,
    topic: r.topic as string,
    courseTitle: r.course_title as string,
    bookingId: (r.booking_id as string) ?? undefined,
    people: Number(r.people),
    castingCount: Number(r.casting_count) > 0 ? Number(r.casting_count) : r.casting ? Number(r.people) : 0, // starší poukazy měly jen ano/ne = pro všechny
    amountCzk: Number(r.amount_czk),
    buyerName: r.buyer_name as string,
    buyerEmail: r.buyer_email as string,
    recipientName: (r.recipient_name as string) ?? undefined,
    message: (r.message as string) ?? undefined,
    status: r.status as VoucherStatus,
    stripeSession: (r.stripe_session as string) ?? undefined,
    createdAt: iso(r.created_at),
    expiresAt: iso(r.expires_at),
    redeemedAt: r.redeemed_at ? iso(r.redeemed_at) : undefined,
  };
}

// Bez znaků, které se pletou (0/O, 1/I/L).
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function randomChunk(len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return s;
}

export function generateVoucherCode(): string {
  return "ATL-" + randomChunk(4) + "-" + randomChunk(4);
}

// Normalizuje kód zadaný člověkem (malá písmena, mezery, chybějící pomlčky) na tvar ATL-XXXX-XXXX.
export function normalizeVoucherCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = raw.startsWith("ATL") ? raw.slice(3) : raw;
  if (body.length !== 8) return input.trim().toUpperCase();
  return "ATL-" + body.slice(0, 4) + "-" + body.slice(4);
}

export function isExpired(v: Pick<Voucher, "expiresAt">, now = new Date()): boolean {
  return new Date(v.expiresAt).getTime() < now.getTime();
}

export class DuplicateVoucherSessionError extends Error {
  constructor() {
    super("Poukaz pro tuhle Stripe session už existuje");
  }
}

export const voucherStore = {
  async all(): Promise<Voucher[]> {
    await ensureSchema();
    const rows = await sql`SELECT * FROM vouchers ORDER BY created_at DESC`;
    return rows.map(rowToVoucher);
  },

  async byId(id: string): Promise<Voucher | null> {
    await ensureSchema();
    const rows = await sql`SELECT * FROM vouchers WHERE id = ${id}`;
    return rows[0] ? rowToVoucher(rows[0]) : null;
  },

  async byCode(code: string): Promise<Voucher | null> {
    await ensureSchema();
    const c = normalizeVoucherCode(code);
    const rows = await sql`SELECT * FROM vouchers WHERE code = ${c}`;
    return rows[0] ? rowToVoucher(rows[0]) : null;
  },

  async byStripeSession(sessionId: string): Promise<Voucher | null> {
    await ensureSchema();
    const rows = await sql`SELECT * FROM vouchers WHERE stripe_session = ${sessionId} LIMIT 1`;
    return rows[0] ? rowToVoucher(rows[0]) : null;
  },

  // Vloží poukaz s novým unikátním kódem; při kolizi kódu (UNIQUE) zkusí jiný.
  async add(v: Omit<Voucher, "id" | "code" | "status" | "createdAt" | "redeemedAt">): Promise<Voucher> {
    await ensureSchema();
    for (let attempt = 0; attempt < 5; attempt++) {
      const id = crypto.randomUUID();
      const code = generateVoucherCode();
      try {
        const rows = await sql`
          INSERT INTO vouchers (id, code, topic, course_title, booking_id, people, casting, casting_count, amount_czk,
                                buyer_name, buyer_email, recipient_name, message, status, stripe_session, expires_at)
          VALUES (${id}, ${code}, ${v.topic}, ${v.courseTitle}, ${v.bookingId ?? null}, ${v.people}, ${v.castingCount > 0}, ${v.castingCount}, ${Math.round(v.amountCzk)},
                  ${v.buyerName}, ${v.buyerEmail}, ${v.recipientName ?? null}, ${v.message ?? null}, 'active', ${v.stripeSession ?? null}, ${v.expiresAt})
          RETURNING *
        `;
        return rowToVoucher(rows[0]);
      } catch (e) {
        const msg = String(e);
        // Stejná Stripe session už poukaz má (souběžné doručení webhooku) — volající to bere jako "už zpracováno".
        if (msg.includes("vouchers_stripe_session_idx")) throw new DuplicateVoucherSessionError();
        if (attempt < 4 && (msg.includes("vouchers_code_key") || msg.toLowerCase().includes("duplicate key"))) continue;
        throw e;
      }
    }
    throw new Error("Nepodařilo se vygenerovat unikátní kód poukazu");
  },

  // Atomické uplatnění: uspěje jen jednou (UPDATE ... WHERE status = 'active'), dvě souběžná uplatnění tak nepropadnou obě.
  async claim(id: string): Promise<boolean> {
    await ensureSchema();
    const rows = await sql`UPDATE vouchers SET status = 'redeemed', redeemed_at = now() WHERE id = ${id} AND status = 'active' RETURNING id`;
    return rows.length > 0;
  },

  // Označení uplatněného / vrácení do stavu active (admin).
  async setStatus(id: string, status: VoucherStatus): Promise<Voucher | null> {
    await ensureSchema();
    if (status === "redeemed") {
      await sql`UPDATE vouchers SET status = 'redeemed', redeemed_at = now() WHERE id = ${id}`;
    } else {
      await sql`UPDATE vouchers SET status = 'active', redeemed_at = NULL WHERE id = ${id}`;
    }
    return this.byId(id);
  },
};

export interface VoucherPaidResult {
  voucher: Voucher;
  booking?: Booking; // pevný termín, pokud ho poukaz má a stále existuje
  signup?: CourseSignup; // vytvořená potvrzená přihláška (jen u pevného termínu)
  overbooked?: boolean; // termín už neměl dost volných míst — přihláška přesto vznikla, admin ať to řeší
  signupFailed?: boolean; // poukaz vznikl, ale přihlášku na pevný termín se nepodařilo vytvořit — admin ať ji doplní ručně
}

function addMonths(d: Date, months: number): Date {
  const r = new Date(d.getTime());
  r.setMonth(r.getMonth() + months);
  return r;
}

// Zpracuje zaplacenou Stripe Checkout Session poukazu (obj = data.object události checkout.session.completed).
// Metadata (nastavuje POST /api/vouchers/checkout): kind=voucher, topic, people, casting (počet odlitků jako text; starší "1"/"0"),
// bookingId (volitelně), buyerName, buyerEmail, recipientName, message.
// Vrací null, pokud se session už zpracovala (Stripe může událost doručit opakovaně) nebo je neplatná.
// Idempotenci zajišťuje unikátní index vouchers_stripe_session_idx: když zápis poukazu selže, Stripe událost
// zopakuje a druhý pokus poukaz vytvoří. Záznam v payments (markPaid) se proto dělá bez ohledu na to, jestli už existuje.
export async function handleVoucherPaid(sessionId: string, obj: Record<string, unknown>): Promise<VoucherPaidResult | null> {
  const meta = (obj.metadata ?? {}) as Record<string, string>;
  const course = voucherCourse(meta.topic ?? "");
  if (!course) {
    console.error("[voucher] Zaplacená session " + sessionId + " s neznámým kurzem: " + meta.topic);
    return null;
  }
  const people = Math.max(1, Math.floor(Number(meta.people) || 1));

  if (await voucherStore.byStripeSession(sessionId)) return null;
  await paymentStore.markPaid(sessionId, PAYMENT_REF, people);

  const details = (obj.customer_details ?? {}) as { email?: string };
  const buyerEmail = (meta.buyerEmail || details.email || "").trim();
  const buyerName = (meta.buyerName || "").trim() || buyerEmail;
  const amountCzk = Number(obj.amount_total ?? 0) / 100;

  // Pevný termín: platí jen pro existující kurz, který není firemní akce.
  let booking: Booking | undefined;
  if (meta.bookingId) {
    const b = (await store.all()).find((x) => x.id === meta.bookingId && x.category === "kurz");
    if (b && !(await courseFlags.isCorporate(b.id))) booking = b;
  }

  let voucher: Voucher;
  try {
    voucher = await voucherStore.add({
      topic: course.key,
      courseTitle: course.title,
      bookingId: booking?.id,
      people,
      castingCount: Math.max(0, Math.min(people, Math.floor(Number(meta.casting) || 0))),
      amountCzk,
      buyerName,
      buyerEmail,
      recipientName: meta.recipientName?.trim() || undefined,
      message: meta.message?.trim() || undefined,
      stripeSession: sessionId,
      expiresAt: addMonths(new Date(), VOUCHER_VALID_MONTHS).toISOString(),
    });
  } catch (e) {
    if (e instanceof DuplicateVoucherSessionError) return null;
    throw e;
  }

  // K platbě přiložíme payment_intent a částku (kvůli případné vratce ve Stripe).
  try {
    await paymentStore.attach(sessionId, {
      paymentIntent: typeof obj.payment_intent === "string" ? obj.payment_intent : undefined,
      amountCzk,
      signupId: "voucher:" + voucher.id,
    });
  } catch (e) {
    console.error("[voucher] Nepodařilo se doplnit údaje k platbě " + sessionId + ":", e);
  }

  if (!booking) return { voucher };

  // Poukaz na pevný termín: rovnou potvrzená přihláška s poznámkou o poukazu.
  let overbooked = false;
  if (booking.capacity) {
    const confirmed = await signupStore.confirmedPeopleForBooking(booking.id);
    overbooked = confirmed + people > booking.capacity;
  }
  const signup: CourseSignup = {
    id: crypto.randomUUID(),
    bookingId: booking.id,
    name: voucher.recipientName || voucher.buyerName,
    contact: voucher.buyerEmail,
    people,
    note:
      "Dárkový poukaz " + voucher.code + " (zaplaceno online, " + amountCzk + " Kč" + (voucher.castingCount > 0 ? ", vč. " + castingText(voucher.castingCount) : "") + ")." +
      (voucher.recipientName ? " Kupující: " + voucher.buyerName + "." : ""),
    status: "confirmed",
    createdAt: new Date().toISOString(),
  };
  try {
    await signupStore.add(signup);
  } catch (e) {
    console.error("[voucher] Poukaz " + voucher.code + " vznikl, ale přihlášku na termín " + booking.id + " se nepodařilo vytvořit:", e);
    return { voucher, booking, signupFailed: true };
  }
  return { voucher, booking, signup, overbooked };
}
