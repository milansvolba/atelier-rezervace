import crypto from "crypto";
import { sql, ensureSchema } from "./db";
import { hashIp } from "./contactMessage";
import { expireStripeSession, getCheckoutSessionState } from "./stripe";

// Slevové promokódy (jednorázové). Tabulka promo_codes je v lib/db.ts.
// Pravidla (rozhodnuto s Milanem 2026-11-16): kód je na jedno použití, sleva se týká jen ceny kurzu (ne odlitků),
// kód se nesčítá s množstevní slevou (platí výhodnější z obou), nekombinuje se s dárkovým poukazem.
// Kód se spotřebuje až po zaplacení (webhook). Rozdělaná platba ho drží 35 minut (jako místa na kurzu).

export type PromoKind = "percent" | "fixed_price";
export type PromoScope = "kurz" | "poukaz" | "oboje";
export type PromoStatus = "active" | "reserved" | "used" | "void";

export interface PromoDiscount {
  kind: PromoKind;
  value: number; // percent: 1 až 100; fixed_price: výsledná cena kurzu v Kč (min. 15 kvůli Stripe)
}

export interface PromoCode extends PromoDiscount {
  id: string;
  code: string;
  scope: PromoScope;
  bookingId?: string;
  label?: string;
  printText?: string;
  maxPeople: number; // nejvýš kolik míst smí kód slevnit
  usedEmail?: string;
  expiresAt: string;
  status: PromoStatus;
  usedAt?: string;
  createdAt: string;
}

export const PROMO_MIN_FIXED_PRICE = 15; // minimální částka platby kartou ve Stripe pro CZK
export const PROMO_MAX_BATCH = 200;
export const PROMO_HOLD_MINUTES = 35;

// Bez znaků, které se pletou (0/O, 1/I/L). 8 znaků = přes 800 miliard kombinací.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function chunk(len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return s;
}

export function generatePromoCode(): string {
  return "SLEVA-" + chunk(4) + "-" + chunk(4);
}

// Kód zadaný člověkem (malá písmena, mezery, bez pomlček) na tvar SLEVA-XXXX-XXXX. Cokoli jiného vrátí null.
export function normalizePromoCode(input: unknown): string | null {
  if (typeof input !== "string" || input.length > 40) return null;
  let raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (raw.startsWith("SLEVA")) raw = raw.slice(5);
  if (!/^[A-Z0-9]{8}$/.test(raw)) return null;
  return "SLEVA-" + raw.slice(0, 4) + "-" + raw.slice(4);
}

function iso(v: unknown): string {
  return typeof v === "string" ? v : (v as Date).toISOString();
}

function rowToPromo(r: Record<string, unknown>): PromoCode {
  return {
    id: r.id as string,
    code: r.code as string,
    kind: r.kind as PromoKind,
    value: Number(r.value),
    scope: r.scope as PromoScope,
    bookingId: (r.booking_id as string) ?? undefined,
    label: (r.label as string) ?? undefined,
    printText: (r.print_text as string) ?? undefined,
    maxPeople: Number(r.max_people) > 0 ? Number(r.max_people) : 1,
    usedEmail: (r.used_email as string) ?? undefined,
    expiresAt: iso(r.expires_at),
    status: r.status as PromoStatus,
    usedAt: r.used_at ? iso(r.used_at) : undefined,
    createdAt: iso(r.created_at),
  };
}

export function describePromo(p: PromoDiscount): string {
  return p.kind === "percent" ? "Sleva " + p.value + " % na kurz" : "Cena kurzu " + p.value + " Kč za osobu";
}

export const GENERIC_PROMO_ERROR = "Tento kód neplatí, nebo už byl použit. Zkontrolujte prosím, zda je opsaný správně.";

export interface PromoContext {
  scope: "kurz" | "poukaz";
  bookingId?: string; // u kurzu: termín, na který se hlásí
}

export function promoFitsContext(p: PromoCode, ctx: PromoContext): boolean {
  if (p.scope !== "oboje" && p.scope !== ctx.scope) return false;
  if (p.bookingId && p.bookingId !== ctx.bookingId) return false;
  return true;
}

export const promoStore = {
  // Vytvoří dávku jedinečných kódů. Kolize s existujícím kódem (prakticky nemožné) se řeší novým pokusem.
  async createBatch(input: {
    count: number;
    kind: PromoKind;
    value: number;
    scope: PromoScope;
    bookingId?: string | null;
    label?: string;
    printText?: string;
    maxPeople: number;
    expiresAt: Date;
  }): Promise<PromoCode[]> {
    await ensureSchema();
    const out: PromoCode[] = [];
    for (let i = 0; i < input.count; i++) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const rows = await sql`
          INSERT INTO promo_codes (id, code, kind, value, scope, booking_id, label, print_text, max_people, expires_at)
          VALUES (${crypto.randomUUID()}, ${generatePromoCode()}, ${input.kind}, ${input.value}, ${input.scope}, ${input.bookingId ?? null}, ${input.label ?? null}, ${input.printText ?? null}, ${input.maxPeople}, ${input.expiresAt.toISOString()})
          ON CONFLICT (code) DO NOTHING
          RETURNING *
        `;
        if (rows[0]) {
          out.push(rowToPromo(rows[0]));
          break;
        }
      }
    }
    return out;
  },

  async all(): Promise<PromoCode[]> {
    await ensureSchema();
    const rows = await sql`SELECT * FROM promo_codes ORDER BY created_at DESC, code`;
    return rows.map(rowToPromo);
  },

  async byLabel(label: string): Promise<PromoCode[]> {
    await ensureSchema();
    const rows = await sql`SELECT * FROM promo_codes WHERE label = ${label} ORDER BY code`;
    return rows.map(rowToPromo);
  },

  async byIds(ids: string[]): Promise<PromoCode[]> {
    await ensureSchema();
    if (ids.length === 0) return [];
    const rows = await sql`SELECT * FROM promo_codes WHERE id = ANY(${ids}) ORDER BY code`;
    return rows.map(rowToPromo);
  },

  // Jen ke čtení: je kód použitelný právě teď pro tento kontext? Nic nezapisuje. Cizí rozdělanou platbu kód blokuje
  // (stav reserved), dokud rezervace nevyprší; vlastní opakovaný pokus řeší až reserveForCheckout.
  async validate(codeInput: unknown, ctx: PromoContext, holdKey?: string): Promise<PromoCode | null> {
    const code = normalizePromoCode(codeInput);
    if (!code) return null;
    await ensureSchema();
    const rows = await sql`
      SELECT * FROM promo_codes
      WHERE code = ${code}
        AND expires_at > now()
        AND (status = 'active' OR (status = 'reserved' AND (reserved_until IS NULL OR reserved_until < now() OR reserved_by = ${holdKey ?? null})))
    `;
    const p = rows[0] ? rowToPromo(rows[0]) : null;
    return p && promoFitsContext(p, ctx) ? p : null;
  },

  // Atomicky si kód „zarezervuje“ pro rozdělanou platbu: projde jen volný kód (active). Dva souběžné pokusy
  // nikdy neprojdou oba. Rezervace jiného zákazníka se nepřepisuje; opakovaný pokus téhož zákazníka řeší
  // reserveForCheckout (nejdřív ukončí jeho starou platební stránku).
  async reserve(codeInput: unknown, ctx: PromoContext, token: string, holdKey: string): Promise<boolean> {
    const code = normalizePromoCode(codeInput);
    if (!code) return false;
    await ensureSchema();
    const rows = await sql`
      UPDATE promo_codes
      SET status = 'reserved', reserved_token = ${token}, reserved_by = ${holdKey},
          reserved_until = now() + make_interval(mins => ${PROMO_HOLD_MINUTES})
      WHERE code = ${code}
        AND expires_at > now()
        AND (scope = 'oboje' OR scope = ${ctx.scope})
        AND (booking_id IS NULL OR booking_id = ${ctx.bookingId ?? null})
        AND status = 'active'
      RETURNING id
    `;
    return rows.length > 0;
  },

  // Rezervace pro checkout. Kód se nikdy nedostane ke dvěma platbám:
  //  - vlastní starší rozdělanou platbu (stejný e-mail) nejdřív ukončíme ve Stripe; když už je zaplacená, kód nevydáme,
  //  - po vypršení času rezervaci nepřebíráme, dokud Stripe nepotvrdí, že platební stránka nebyla zaplacena
  //    (zpožděný webhook by jinak kód spotřeboval podruhé), a nejde-li stav zjistit, kód nevydáme.
  async reserveForCheckout(codeInput: unknown, ctx: PromoContext, token: string, holdKey: string): Promise<boolean> {
    const code = normalizePromoCode(codeInput);
    if (!code) return false;
    await ensureSchema();
    const rows = await sql`SELECT reserved_token, reserved_by, (reserved_until IS NULL OR reserved_until < now()) AS lapsed FROM promo_codes WHERE code = ${code} AND status = 'reserved'`;
    const prev = rows[0] as { reserved_token: string | null; reserved_by: string | null; lapsed: boolean | string } | undefined;
    if (prev) {
      const tok = prev.reserved_token ?? "";
      const lapsed = prev.lapsed === true || prev.lapsed === "t" || prev.lapsed === "true";
      const own = prev.reserved_by === holdKey;
      if (tok.startsWith("cs_")) {
        if (own || lapsed) {
          if (!lapsed) {
            if (!(await expireStripeSession(tok))) return false; // už zaplaceno, nebo Stripe neodpovídá: kód nevydáme
          } else {
            const st = await getCheckoutSessionState(tok);
            if (!st || st.paymentStatus === "paid" || st.status === "complete") return false;
            if (st.status === "open") {
              if (!(await expireStripeSession(tok))) return false;
            }
          }
          await sql`UPDATE promo_codes SET status = 'active', reserved_token = NULL, reserved_by = NULL, reserved_until = NULL WHERE code = ${code} AND status = 'reserved' AND reserved_token = ${tok}`;
        } else {
          return false;
        }
      } else if (lapsed) {
        // Dočasný token (platba se právě zakládá) a čas vypršel: spadlo to při zakládání, uvolníme.
        await sql`UPDATE promo_codes SET status = 'active', reserved_token = NULL, reserved_by = NULL, reserved_until = NULL WHERE code = ${code} AND status = 'reserved' AND reserved_token = ${tok}`;
      } else {
        return false;
      }
    }
    return this.reserve(codeInput, ctx, token, holdKey);
  },

  // Po vytvoření platební stránky se dočasný token nahradí ID session ze Stripe.
  async attachSession(token: string, sessionId: string): Promise<void> {
    await ensureSchema();
    await sql`UPDATE promo_codes SET reserved_token = ${sessionId} WHERE reserved_token = ${token} AND status = 'reserved'`;
  },

  // Uvolní rezervaci (platba se nepodařila zahájit, nebo platební stránka vypršela).
  async release(tokenOrSession: string): Promise<void> {
    await ensureSchema();
    await sql`
      UPDATE promo_codes SET status = 'active', reserved_token = NULL, reserved_by = NULL, reserved_until = NULL
      WHERE reserved_token = ${tokenOrSession} AND status = 'reserved'
    `;
  },

  // Webhook po zaplacení: kód se spotřebuje. Idempotentní (opakované doručení téže platby nic nezmění).
  // Spotřebuje se i tehdy, kdyby mezitím vypršel nebo byl zrušen: platba už proběhla.
  // Vrací "conflict", když byl kód už použit JINOU platbou (správce má o tom dostat upozornění).
  async markUsed(codeInput: unknown, sessionId: string, email?: string): Promise<"ok" | "same" | "conflict" | "unknown"> {
    const code = normalizePromoCode(codeInput);
    if (!code) return "unknown";
    await ensureSchema();
    const rows = await sql`
      UPDATE promo_codes SET status = 'used', used_at = now(), used_session = ${sessionId}, used_email = ${email ? email.toLowerCase().slice(0, 200) : null},
        reserved_token = NULL, reserved_by = NULL, reserved_until = NULL
      WHERE code = ${code} AND status <> 'used'
      RETURNING id
    `;
    if (rows.length > 0) return "ok";
    const cur = await sql`SELECT used_session FROM promo_codes WHERE code = ${code}`;
    if (!cur[0]) return "unknown";
    return cur[0].used_session === sessionId ? "same" : "conflict";
  },

  // Správce zruší nepoužité kódy. U kódu s rozdělanou platbou se nejdřív ukončí platební stránka ve Stripe;
  // když už je zaplacená (nebo nejde ukončit), kód zůstane a není zrušen. Použité kódy zrušit nejde.
  async voidCodes(ids: string[]): Promise<{ voided: number; skipped: number }> {
    await ensureSchema();
    if (ids.length === 0) return { voided: 0, skipped: 0 };
    const rows = await sql`SELECT id, status, reserved_token FROM promo_codes WHERE id = ANY(${ids}) AND status IN ('active', 'reserved')`;
    let voided = 0;
    let skipped = 0;
    for (const r of rows) {
      const tok = (r.reserved_token as string | null) ?? "";
      if (r.status === "reserved" && tok.startsWith("cs_") && !(await expireStripeSession(tok))) {
        skipped++;
        continue;
      }
      const u = await sql`
        UPDATE promo_codes SET status = 'void', reserved_token = NULL, reserved_by = NULL, reserved_until = NULL
        WHERE id = ${r.id as string} AND status IN ('active', 'reserved') RETURNING id
      `;
      if (u.length) voided++;
      else skipped++;
    }
    return { voided, skipped };
  },
};

// --- Omezení hádání kódů: neúspěšné pokusy podle IP (otisk) za 10 minut a velmi vysoký celkový strop za hodinu ---
// Hádání brání hlavně entropie kódu (přes 800 miliard kombinací); limit na IP brzdí skripty. Celkový strop je
// záměrně vysoký, aby ho útočník nemohl použít k zablokování slev všem zákazníkům (ten řeší pravidlo ve Vercel Firewall).
const LIMIT_FAILS_PER_IP_10MIN = 12;
const LIMIT_FAILS_TOTAL_HOUR = 3000;

// IPv6 adresa se bere po prvních 64 bitech (jedna domácnost má celý blok), IPv4 celá.
export function ipKey(ip: string): string {
  const v = ip.trim().toLowerCase();
  if (!v.includes(":")) return v;
  const [head, tail = ""] = v.split("::");
  const a = head ? head.split(":") : [];
  const b = tail ? tail.split(":") : [];
  const full = v.includes("::") ? [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill("0"), ...b] : a;
  return full.slice(0, 4).map((x) => x.padStart(4, "0")).join(":");
}

export function clientIpHash(req: { headers: { get(name: string): string | null } }): string | null {
  const ip = ((req.headers.get("x-forwarded-for") || "").split(",")[0] || req.headers.get("x-real-ip") || "").trim();
  return ip ? hashIp(ipKey(ip)) : null;
}

// Zapíše pokus PŘED ověřením kódu (souběžné dávky požadavků tak nepřekročí limit) a vrátí, zda je limit překročen.
// Po úspěšném ověření zavolejte promoAttemptSucceeded (úspěšný pokus se do limitu nepočítá).
export async function promoAttemptStart(ipHash: string | null): Promise<{ blocked: boolean; id: number }> {
  await ensureSchema();
  const ins = await sql`INSERT INTO promo_attempts (ip_hash, ok) VALUES (${ipHash}, false) RETURNING id`;
  const id = Number(ins[0].id);
  const rows = await sql`
    SELECT
      count(*) FILTER (WHERE created_at > now() - interval '10 minutes' AND ${ipHash}::text IS NOT NULL AND ip_hash = ${ipHash})::int AS by_ip,
      count(*)::int AS total
    FROM promo_attempts
    WHERE ok = false AND created_at > now() - interval '1 hour'
  `;
  const r = rows[0] as { by_ip: number; total: number };
  if (Math.random() < 0.02) await sql`DELETE FROM promo_attempts WHERE created_at < now() - interval '2 days'`;
  return { blocked: r.by_ip > LIMIT_FAILS_PER_IP_10MIN || r.total > LIMIT_FAILS_TOTAL_HOUR, id };
}

export async function promoAttemptSucceeded(id: number): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM promo_attempts WHERE id = ${id}`;
}

export function maxPeopleMessage(max: number): string {
  return "Tento kód platí nejvýše pro " + max + " " + (max === 1 ? "místo" : max <= 4 ? "místa" : "míst") + ". Snižte prosím počet míst v objednávce.";
}
