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
      INSERT INTO course_signups (id, booking_id, name, contact, people, note, status, created_at)
      VALUES (${s.id}, ${s.bookingId}, ${s.name}, ${s.contact}, ${s.people}, ${s.note ?? null}, ${s.status}, ${s.createdAt})
    `;
    return s;
  },

  async updateStatus(id: string, status: SignupStatus): Promise<CourseSignup | null> {
    await ensureSchema();
    await sql`UPDATE course_signups SET status = ${status} WHERE id = ${id}`;
    const rows = await sql`SELECT * FROM course_signups WHERE id = ${id}`;
    return rows[0] ? rowToSignup(rows[0]) : null;
  },

  async byId(id: string): Promise<CourseSignup | null> {
    await ensureSchema();
    const rows = await sql`SELECT * FROM course_signups WHERE id = ${id}`;
    return rows[0] ? rowToSignup(rows[0]) : null;
  },
};
