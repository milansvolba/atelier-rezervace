import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const IDS = ["66130876-f639-408b-ae45-5d38b0deb205", "4c4d6779-9d2a-4bb9-b7bc-050757aff529"];

export async function GET() {
  const noOrder = await sql`SELECT * FROM bookings WHERE id = ANY(${IDS})`;
  const withOrder = await sql`SELECT * FROM bookings WHERE id = ANY(${IDS}) ORDER BY date, start_time`;
  const allNoOrder = await sql`SELECT * FROM bookings`;
  const allWithOrder = await sql`SELECT * FROM bookings ORDER BY date, start_time`;
  return NextResponse.json({
    noOrderCount: noOrder.length,
    noOrderRows: noOrder,
    withOrderCount: withOrder.length,
    withOrderRows: withOrder,
    allNoOrderCount: allNoOrder.length,
    allWithOrderCount: allWithOrder.length,
  });
}
