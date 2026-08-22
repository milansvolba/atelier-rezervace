import { NextResponse } from "next/server";
import { store } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const all = await store.all();
  const today = new Date().toISOString().slice(0, 10);
  const courses = all.filter((b) => b.category === "kurz" && b.status === "confirmed" && b.date >= today);
  return NextResponse.json({
    todayStr: today,
    allCount: all.length,
    coursesCount: courses.length,
    all: all.map((b) => ({ id: b.id, date: b.date, category: b.category, status: b.status, title: b.title })),
  });
}
