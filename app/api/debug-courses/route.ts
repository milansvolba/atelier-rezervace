import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  await sql`DROP INDEX IF EXISTS bookings_date_idx`;
  const counts = [];
  for (let i = 0; i < 6; i++) {
    const rows = await sql`SELECT id FROM bookings ORDER BY date, start_time`;
    counts.push(rows.length);
  }
  return NextResponse.json({ counts });
}
