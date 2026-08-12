import { sql, ensureSchema } from "./db";

export interface EmailLogEntry {
  id: string;
  type: string;
  recipient: string;
  subject: string;
  bookingId?: string;
  signupId?: string;
  status: "sent" | "failed" | "skipped";
  error?: string;
  createdAt: string;
}

function rowToEntry(r: Record<string, unknown>): EmailLogEntry {
  const created = r.created_at as string | Date;
  return {
    id: r.id as string,
    type: r.type as string,
    recipient: r.recipient as string,
    subject: r.subject as string,
    bookingId: (r.booking_id as string) ?? undefined,
    signupId: (r.signup_id as string) ?? undefined,
    status: r.status as EmailLogEntry["status"],
    error: (r.error as string) ?? undefined,
    createdAt: typeof created === "string" ? created : created.toISOString(),
  };
}

// Zapíše pokus o odeslání e-mailu do logu. Nikdy nevyhodí chybu ven — logování
// nesmí shodit samotné odeslání žádosti/rezervace, kvůli které se e-mail posílá.
export async function logEmail(entry: {
  type: string;
  recipient: string;
  subject: string;
  bookingId?: string;
  signupId?: string;
  status: "sent" | "failed" | "skipped";
  error?: string;
}): Promise<void> {
  try {
    await ensureSchema();
    await sql`
      INSERT INTO email_log (id, type, recipient, subject, booking_id, signup_id, status, error, created_at)
      VALUES (${crypto.randomUUID()}, ${entry.type}, ${entry.recipient}, ${entry.subject}, ${entry.bookingId ?? null}, ${entry.signupId ?? null}, ${entry.status}, ${entry.error ?? null}, now())
    `;
  } catch (err) {
    console.error("[emailLog] Zápis do logu selhal:", err);
  }
}

export async function recentEmailLog(limit = 100): Promise<EmailLogEntry[]> {
  await ensureSchema();
  const rows = await sql`SELECT * FROM email_log ORDER BY created_at DESC LIMIT ${limit}`;
  return rows.map(rowToEntry);
}

export async function emailLogForBooking(bookingId: string): Promise<EmailLogEntry[]> {
  await ensureSchema();
  const rows = await sql`SELECT * FROM email_log WHERE booking_id = ${bookingId} ORDER BY created_at DESC`;
  return rows.map(rowToEntry);
}
