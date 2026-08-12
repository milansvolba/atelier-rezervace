import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { recentEmailLog } from "@/lib/emailLog";

// GET /api/admin/email-log — posledních N odeslaných e-mailů (přehled pro admina).
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(500, Math.max(1, Number(limitParam))) : 100;
  const log = await recentEmailLog(limit);
  return NextResponse.json(log);
}
