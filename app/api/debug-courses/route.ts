import { NextResponse } from "next/server";
import { store } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  const counts = [];
  for (let i = 0; i < 5; i++) {
    const all = await store.all();
    const courses = all.filter((b) => b.category === "kurz" && b.status === "confirmed" && b.date >= today);
    counts.push({ allLen: all.length, coursesLen: courses.length });
  }
  return NextResponse.json({ counts });
}
