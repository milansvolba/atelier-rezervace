import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
    const noOrder = await sql`SELECT id, title FROM bookings WHERE date = '2026-09-29'`;
    const withOrder = await sql`SELECT id, title FROM bookings ORDER BY date, start_time`;
    const withOrderFiltered = withOrder.filter((r) => r.id === "4c4d6779-9d2a-4bb9-b7bc-050757aff529");
    return NextResponse.json({
          noOrderCount: noOrder.length,
          noOrderIds: noOrder.map((r) => r.id),
          withOrderCount: withOrder.length,
          deletedRowStillInOrderQuery: withOrderFiltered.length > 0,
    });
}
