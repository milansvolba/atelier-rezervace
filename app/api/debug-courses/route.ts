import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const all = await store.all();
  const raw = await sql`SELECT id FROM bookings ORDER BY date, start_time`;
  const today = new Date().toISOString().slice(0, 10);
  const courses = all.filter((b) => b.category === "kurz" && b.status === "confirmed" && b.date >= today);
  return NextResponse.json({
    storeAllCount: all.length,
    storeAllIds: all.map((b) => b.id),
    rawCount: raw.length,
    rawIds: raw.map((r) => r.id),
    coursesCount: courses.length,
    courses,
  });
}
