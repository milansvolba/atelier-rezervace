import { sql, ensureSchema } from "./db";
import { Booking, ResourceId, resourcesConflict, timesOverlap } from "./types";

function rowToBooking(r: Record<string, unknown>): Booking {
  const date = r.date as string | Date;
  const created = r.created_at as string | Date;
  return {
    id: r.id as string,
    resource: r.resource as ResourceId,
    date: typeof date === "string" ? date.slice(0, 10) : date.toISOString().slice(0, 10),
    startTime: r.start_time as string,
    endTime: r.end_time as string,
    title: r.title as string,
    requesterName: (r.requester_name as string) ?? undefined,
    requesterContact: (r.requester_contact as string) ?? undefined,
    note: (r.note as string) ?? undefined,
    status: r.status as Booking["status"],
    source: r.source as Booking["source"],
    extraMonitor: (r.extra_monitor as boolean) ?? false,
    createdAt: typeof created === "string" ? created : created.toISOString(),
  };
}

export const store = {
  async all(): Promise<Booking[]> {
    await ensureSchema();
    const rows = await sql`SELECT * FROM bookings ORDER BY date, start_time`;
    return rows.map(rowToBooking);
  },

  async add(b: Booking): Promise<Booking> {
    await ensureSchema();
    await sql`
      INSERT INTO bookings
        (id, resource, date, start_time, end_time, title, requester_name, requester_contact, note, status, source, extra_monitor, created_at)
      VALUES
        (${b.id}, ${b.resource}, ${b.date}, ${b.startTime}, ${b.endTime}, ${b.title},
         ${b.requesterName ?? null}, ${b.requesterContact ?? null}, ${b.note ?? null},
         ${b.status}, ${b.source}, ${b.extraMonitor ?? false}, ${b.createdAt})
    `;
    return b;
  },

  async update(id: string, patch: Partial<Booking>): Promise<Booking | null> {
    await ensureSchema();
    if (patch.status) {
      await sql`UPDATE bookings SET status = ${patch.status} WHERE id = ${id}`;
    }
    const rows = await sql`SELECT * FROM bookings WHERE id = ${id}`;
    return rows[0] ? rowToBooking(rows[0]) : null;
  },

  async byDate(date: string): Promise<Booking[]> {
    await ensureSchema();
    const rows = await sql`SELECT * FROM bookings WHERE date = ${date}`;
    return rows.map(rowToBooking);
  },
};

// Zjistí, jestli by nová rezervace kolidovala s existujícími potvrzenými.
// Nepotvrzené (pending) žádosti podle specifikace nic neblokují, dokud je admin neschválí.
export async function findConflict(
  resource: ResourceId,
  date: string,
  startTime: string,
  endTime: string,
  ignoreId?: string
): Promise<Booking | null> {
  const dayBookings = await store.byDate(date);
  const existing = dayBookings.filter((b) => b.status === "confirmed" && b.id !== ignoreId);
  for (const b of existing) {
    if (resourcesConflict(resource, b.resource) && timesOverlap(startTime, endTime, b.startTime, b.endTime)) {
      return b;
    }
  }
  return null;
}
