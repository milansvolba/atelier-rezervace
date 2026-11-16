import { createHash } from "crypto";
import { sql, ensureSchema } from "./db";
import { clientIpHash } from "./promo";

// Obecné omezení počtu požadavků na veřejné koncové body (spam, zahlcení e-mailů, blokování míst).
// Každý požadavek se zapíše PŘED kontrolou (souběžná dávka požadavků tak limit nepřekročí) a spočítá se, kolik
// jich za okno bylo se stejným klíčem. Ukládá se jen nevratný otisk IP nebo e-mailu.

export interface Limit {
  /** Nejvýše tolik požadavků… */
  max: number;
  /** …za tolik sekund. */
  windowSec: number;
}

export function emailKey(email: string): string {
  return createHash("sha256").update("email:" + email.trim().toLowerCase() + (process.env.CONTACT_IP_SALT || "atelier")).digest("hex").slice(0, 32);
}

/** true = limit je překročený a požadavek je potřeba odmítnout. */
export async function rateLimited(scope: string, keyHash: string | null, limit: Limit): Promise<boolean> {
  // Bez rozpoznané IP omezení neblokujeme (celkový strop hlídá WAF), ať neblokujeme všechny.
  if (!keyHash) return false;
  try {
    await ensureSchema();
    await sql`INSERT INTO rate_hits (scope, key_hash) VALUES (${scope}, ${keyHash})`;
    const rows = await sql`
      SELECT count(*)::int AS n FROM rate_hits
      WHERE scope = ${scope} AND key_hash = ${keyHash} AND created_at > now() - make_interval(secs => ${limit.windowSec})
    `;
    if (Math.random() < 0.02) await sql`DELETE FROM rate_hits WHERE created_at < now() - interval '2 days'`;
    return Number((rows[0] as { n: number }).n) > limit.max;
  } catch (e) {
    // Selhání databáze nesmí rozbít formulář: radši propustit, než zablokovat zákazníky.
    console.error("[rateLimit] chyba:", e);
    return false;
  }
}

/** Limit podle IP návštěvníka (scope odděluje jednotlivé formuláře). */
export function ipLimited(req: { headers: { get(name: string): string | null } }, scope: string, limit: Limit): Promise<boolean> {
  return rateLimited(scope, clientIpHash(req), limit);
}

export const TOO_MANY = "Příliš mnoho požadavků. Zkuste to prosím za chvíli.";
