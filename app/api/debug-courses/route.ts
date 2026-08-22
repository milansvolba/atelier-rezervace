import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const explicitCols = await sql`SELECT id, resource, date, start_time, end_time, title, requester_name, requester_contact, note, status, source, extra_monitor, created_at, user_id, category, capacity, price FROM bookings ORDER BY date, start_time`;
  const starCols = await sql`SELECT * FROM bookings ORDER BY date, start_time`;
  const noteOnly = await sql`SELECT id, note FROM bookings ORDER BY date, start_time`;
  const createdOnly = await sql`SELECT id, created_at FROM bookings ORDER BY date, start_time`;
  const priceOnly = await sql`SELECT id, price, capacity FROM bookings ORDER BY date, start_time`;
  return NextResponse.json({
    explicitColsCount: explicitCols.length,
    starColsCount: starCols.length,
    noteOnlyCount: noteOnly.length,
    createdOnlyCount: createdOnly.length,
    priceOnlyCount: priceOnly.length,
  });
}
