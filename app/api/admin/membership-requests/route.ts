import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { membershipRequests } from "@/lib/membershipRequests";

export const dynamic = "force-dynamic";

// GET /api/admin/membership-requests: čekající žádosti o členství (jen admin).
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await membershipRequests.pending());
}
