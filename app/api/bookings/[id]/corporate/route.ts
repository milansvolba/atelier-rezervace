import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { courseFlags } from "@/lib/courseFlags";

export const dynamic = "force-dynamic";

// GET /api/bookings/:id/corporate — je termín firemní akce (skrytá na veřejných /kurzy)? Jen admin.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ corporate: await courseFlags.isCorporate(params.id) });
}

// PUT /api/bookings/:id/corporate { corporate: boolean } — přepnout příznak firemní akce. Jen admin.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { corporate } = await req.json();
  if (typeof corporate !== "boolean") return NextResponse.json({ error: "chybí hodnota corporate" }, { status: 400 });
  await courseFlags.setCorporate(params.id, corporate);
  return NextResponse.json({ ok: true, corporate });
}
