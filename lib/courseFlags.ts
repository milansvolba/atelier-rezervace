import { sql, ensureSchema } from "./db";

// Příznaky termínů kurzů. Zatím jen "corporate": firemní akce, která se nezobrazuje na veřejné
// stránce /kurzy a nejde se na ni veřejně přihlásit ani platit (řeší se fakturou/domluvou).
export const courseFlags = {
  async corporateIds(): Promise<Set<string>> {
    await ensureSchema();
    const rows = await sql`SELECT booking_id FROM course_flags WHERE corporate = true`;
    return new Set(rows.map((r) => r.booking_id as string));
  },

  async isCorporate(bookingId: string): Promise<boolean> {
    await ensureSchema();
    const rows = await sql`SELECT corporate FROM course_flags WHERE booking_id = ${bookingId}`;
    return !!rows[0]?.corporate;
  },

  async setCorporate(bookingId: string, corporate: boolean): Promise<void> {
    await ensureSchema();
    await sql`
      INSERT INTO course_flags (booking_id, corporate) VALUES (${bookingId}, ${corporate})
      ON CONFLICT (booking_id) DO UPDATE SET corporate = EXCLUDED.corporate
    `;
  },
};
