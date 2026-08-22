import { NextResponse } from "next/server";
import { store } from "@/lib/data";

export const dynamic = "force-dynamic";

function maskUrl(u) {
  if (!u) return null;
  try {
    const parsed = new URL(u);
    return { host: parsed.host, pathname: parsed.pathname, hasPassword: !!parsed.password };
  } catch (e) {
    return "parse-error";
  }
}

export async function GET() {
  const all = await store.all();
  const today = new Date().toISOString().slice(0, 10);
  const courses = all.filter((b) => b.category === "kurz" && b.status === "confirmed" && b.date >= today);
  return NextResponse.json({
    todayStr: today,
    allCount: all.length,
    coursesCount: courses.length,
    all: all.map((b) => ({ id: b.id, date: b.date, category: b.category, status: b.status, title: b.title })),
    env: {
      vercelEnv: process.env.VERCEL_ENV,
      gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA,
      gitCommitRef: process.env.VERCEL_GIT_COMMIT_REF,
      region: process.env.VERCEL_REGION,
      databaseUrl: maskUrl(process.env.DATABASE_URL),
      postgresUrl: maskUrl(process.env.POSTGRES_URL),
    },
  });
}
