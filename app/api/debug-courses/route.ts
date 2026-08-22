import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSchema();
  const before = await sql`SELECT id FROM bookings ORDER BY date, start_time`;
  await sql`REINDEX INDEX bookings_date_idx`;
  const after = await sql`SELECT id FROM bookings ORDER BY date, start_time`;
  return NextResponse.json({
    beforeCount: before.length,
    beforeIds: before.map((r) => r.id),
    afterCount: after.length,
    afterIds: after.map((r) => r.id),
  });
}
