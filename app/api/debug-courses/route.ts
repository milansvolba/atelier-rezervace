import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const all = await store.all();
  const rawRows = await sql`SELECT id, date, category, status FROM bookings ORDER BY date`;
  const rawCount = await sql`SELECT count(*) as cnt FROM bookings`;
  return NextResponse.json({
    allCount: all.length,
    allIds: all.map((b) => b.id),
    rawCount: rawCount[0],
    rawRowsCount: rawRows.length,
    rawIds: rawRows.map((r) => r.id),
    env: {
      vercelEnv: process.env.VERCEL_ENV,
      gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA,
      region: process.env.VERCEL_REGION,
    },
  });
}
