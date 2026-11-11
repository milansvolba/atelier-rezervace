import { sql, ensureSchema } from "./db";
import { validEmail } from "./signupContact";
import { hashIp } from "./contactMessage";

// Žádosti o členství z úvodní stránky /clenstvi („Chci do klubu“).
// Žádost se uloží, admin ji jedním klikem schválí (vznikne účet a odejde e-mail s odkazem na platbu).

export { hashIp };

export const REQUEST_LIMITS = {
  nameMax: 100,
  emailMax: 200,
  phoneMax: 40,
  messageMax: 1000,
  perIpPerHour: 5,
  perEmailPerHour: 3,
  totalPerHour: 40,
};

export type RequestStatus = "pending" | "approved" | "rejected";

export interface MembershipRequest {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  status: RequestStatus;
  createdAt: string;
}

export interface RequestInput {
  name: string;
  email: string;
  phone: string;
  message: string;
}

function clean(s: unknown, multiline: boolean): string {
  let t = String(s ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  if (!multiline) t = t.replace(/\s+/g, " ");
  else t = t.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

export type RequestValidation = { ok: true; value: RequestInput } | { ok: false; error: string };

export function validateRequest(body: unknown): RequestValidation {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const name = clean(b.name, false);
  const email = clean(b.email, false);
  const phone = clean(b.phone, false);
  const message = clean(b.message, true);

  if (!name) return { ok: false, error: "Vyplňte prosím jméno." };
  if (name.length > REQUEST_LIMITS.nameMax) return { ok: false, error: "Jméno je moc dlouhé." };
  if (!email || email.length > REQUEST_LIMITS.emailMax || !validEmail(email)) {
    return { ok: false, error: "E-mail nevypadá správně. Zkontrolujte ho prosím, například jmeno@domena.cz." };
  }
  if (phone.length > REQUEST_LIMITS.phoneMax) return { ok: false, error: "Telefon je moc dlouhý." };
  if (message.length > REQUEST_LIMITS.messageMax) {
    return { ok: false, error: "Vzkaz je moc dlouhý. Zkraťte ho prosím." };
  }
  if (b.consent !== true) return { ok: false, error: "Potvrďte prosím souhlas se zpracováním údajů." };
  return { ok: true, value: { name, email, phone, message } };
}

// Hodně odkazů ve vzkazu = nejspíš spam.
export function looksLikeSpam(message: string): boolean {
  return (message.match(/https?:\/\/|www\./gi) || []).length > 1;
}

function rowToRequest(r: Record<string, unknown>): MembershipRequest {
  const created = r.created_at as string | Date;
  return {
    id: r.id as string,
    name: r.name as string,
    email: r.email as string,
    phone: (r.phone as string | null) || null,
    message: (r.message as string | null) || null,
    status: r.status as RequestStatus,
    createdAt: typeof created === "string" ? created : created.toISOString(),
  };
}

export const membershipRequests = {
  // true = limit je překročený a žádost je potřeba odmítnout.
  async isRateLimited(email: string, ipHash: string | null): Promise<boolean> {
    await ensureSchema();
    const rows = await sql`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE email = ${email.toLowerCase()})::int AS by_email,
        count(*) FILTER (WHERE ${ipHash}::text IS NOT NULL AND ip_hash = ${ipHash})::int AS by_ip
      FROM membership_requests
      WHERE created_at > now() - interval '1 hour'
    `;
    const r = rows[0] as { total: number; by_email: number; by_ip: number };
    return (
      r.total >= REQUEST_LIMITS.totalPerHour ||
      r.by_email >= REQUEST_LIMITS.perEmailPerHour ||
      r.by_ip >= REQUEST_LIMITS.perIpPerHour
    );
  },

  async add(input: RequestInput, ipHash: string | null): Promise<MembershipRequest> {
    await ensureSchema();
    const id = crypto.randomUUID();
    const rows = await sql`
      INSERT INTO membership_requests (id, name, email, phone, message, ip_hash)
      VALUES (${id}, ${input.name}, ${input.email.toLowerCase()}, ${input.phone || null}, ${input.message || null}, ${ipHash})
      RETURNING *
    `;
    return rowToRequest(rows[0]);
  },

  async pending(): Promise<MembershipRequest[]> {
    await ensureSchema();
    const rows = await sql`SELECT * FROM membership_requests WHERE status = 'pending' ORDER BY created_at`;
    return rows.map(rowToRequest);
  },

  async byId(id: string): Promise<MembershipRequest | null> {
    await ensureSchema();
    const rows = await sql`SELECT * FROM membership_requests WHERE id = ${id}`;
    return rows[0] ? rowToRequest(rows[0]) : null;
  },

  // Přepne čekající žádost na nový stav. Vrací false, když už byla vyřízená (dvojklik, druhý admin).
  async decide(id: string, status: "approved" | "rejected"): Promise<boolean> {
    await ensureSchema();
    const rows = await sql`UPDATE membership_requests SET status = ${status}, decided_at = now()
      WHERE id = ${id} AND status = 'pending' RETURNING id`;
    return rows.length > 0;
  },

  // Když se po „schválení“ nepovede vytvořit účet, žádost se vrátí mezi čekající.
  async reopen(id: string): Promise<void> {
    await ensureSchema();
    await sql`UPDATE membership_requests SET status = 'pending', decided_at = NULL WHERE id = ${id}`;
  },
};
