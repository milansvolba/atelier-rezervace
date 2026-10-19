import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { voucherStore } from "@/lib/vouchers";

export const dynamic = "force-dynamic";

// GET /api/vouchers — přehled všech poukazů pro admina.
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await voucherStore.all());
}
