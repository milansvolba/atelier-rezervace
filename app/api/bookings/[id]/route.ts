import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/data";
import { requireAdmin } from "@/lib/auth";

// DELETE /api/bookings/:id — admin smaže rezervaci.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await store.remove(params.id);
  return NextResponse.json({ ok: true });
}
