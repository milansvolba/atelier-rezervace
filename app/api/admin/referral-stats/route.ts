import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

type CountRow = { label: string; count: number };

// GET /api/admin/referral-stats — admin přehled "odkud o nás víte?" napříč žádostmi
// (bookings), přihláškami/platbami na kurz (course_signups) a nákupy poukazů (vouchers).
// Řádky bez vyplněné hodnoty se do součtu nepočítají (pole je nepovinné).
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureSchema();

  const bookings = (await sql`
    SELECT heard_about AS label, COUNT(*)::int AS count FROM bookings
    WHERE heard_about IS NOT NULL AND heard_about <> '' GROUP BY heard_about
  `) as CountRow[];
  const signups = (await sql`
    SELECT heard_about AS label, COUNT(*)::int AS count FROM course_signups
    WHERE heard_about IS NOT NULL AND heard_about <> '' GROUP BY heard_about
  `) as CountRow[];
  const vouchers = (await sql`
    SELECT heard_about AS label, COUNT(*)::int AS count FROM vouchers
    WHERE heard_about IS NOT NULL AND heard_about <> '' GROUP BY heard_about
  `) as CountRow[];

  const combinedMap = new Map<string, number>();
  for (const rows of [bookings, signups, vouchers]) {
    for (const r of rows) {
      combinedMap.set(r.label, (combinedMap.get(r.label) ?? 0) + Number(r.count));
    }
  }
  const combined = Array.from(combinedMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({ combined, bookings, signups, vouchers });
}
