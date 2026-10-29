import { sql, ensureSchema } from "./db";
import { CourseSignup, SignupStatus } from "./types";

function rowToSignup(r: Record<string, unknown>): CourseSignup {
  const created = r.created_at as string | Date;
  return {
    id: r.id as string,
    bookingId: r.booking_id as string,
    name: r.name as string,
    contact: r.contact as string,
    people: r.people as number,
    note: (r.note as string) ?? undefined,
    status: r.status as SignupStatus,
    createdAt: typeof created === "string" ? created : created.toISOString(),
    heardAbout: (r.heard_about as string) ?? undefined,
    phone: (r.phone as string) ?? undefined,
    notifyEmail: (r.notify_email as string) ?? undefined,
  };
}

export const signupStore = {
  async all(): Promise<CourseSignup[]> {
    await ensureSchema();
    const rows = await sql`SELECT * FROM course_signups ORDER BY created_at DESC`;
    return rows.map(rowToSignup);
  },

  async byBooking(bookingId: string): Promise<CourseSignup[]> {
    await ensureSchema();
    const rows = await sql`SELECT * FROM course_signups WHERE booking_id = ${bookingId} ORDER BY created_at`;
    return rows.map(rowToSignup);
  },

  // Součet potvrzených účastníků na daný termín — pro výpočet volné kapacity.
  async confirmedPeopleForBooking(bookingId: string): Promise<number> {
    await ensureSchema();
    const rows = await sql`
      SELECT COALESCE(SUM(people), 0) AS total FROM course_signups
      WHERE booking_id = ${bookingId} AND status = 'confirmed'
    `;
    return Number(rows[0]?.total ?? 0);
  },

  async add(s: CourseSignup): Promise<CourseSignup> {
    await ensureSchema();
    await sql`
      INSERT INTO course_signups (id, booking_id, name, contact, people, note, status, created_at, heard_about, phone, notify_email)
      VALUES (${s.id}, ${s.bookingId}, ${s.name}, ${s.contact}, ${s.people}, ${s.note ?? null}, ${s.status}, ${s.createdAt}, ${s.heardAbout ?? null}, ${s.phone ?? null}, ${s.notifyEmail ?? null})
    `;
    return s;
  },

  async updateStatus(id: string, status: SignupStatus): Promise<CourseSignup | null> {
    await ensureSchema();
    await sql`UPDATE course_signups SET status = ${status} WHERE id = ${id}`;
    const rows = await sql`SELECT * FROM course_signups WHERE id = ${id}`;
    return rows[0] ? rowToSignup(rows[0]) : null;
  },

  // Doplnění kontaktu u přihlášky z poukazu (obdarovaný dodá e-mail/telefon později).
  async updateContact(id: string, c: { phone?: string; notifyEmail?: string }): Promise<void> {
    await ensureSchema();
    await sql`UPDATE course_signups SET phone = ${c.phone ?? null}, notify_email = ${c.notifyEmail ?? null} WHERE id = ${id}`;
  },

  async byId(id: string): Promise<CourseSignup | null> {
    await ensureSchema();
    const rows = await sql`SELECT * FROM course_signups WHERE id = ${id}`;
    return rows[0] ? rowToSignup(rows[0]) : null;
  },
};
