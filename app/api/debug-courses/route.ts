import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { sql, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSchema();
  const exact = await sql`SELECT * FROM bookings ORDER BY date, start_time`;
  const noOrder = await sql`SELECT * FROM bookings`;
  const all = await store.all();
  return NextResponse.json({
    exactCount: exact.length,
    exactIds: exact.map((r) => r.id),
    noOrderCount: noOrder.length,
    noOrderIds: noOrder.map((r) => r.id),
    storeAllCount: all.length,
    storeAllIds: all.map((b) => b.id),
    sampleRow: exact[0],
  });
}
