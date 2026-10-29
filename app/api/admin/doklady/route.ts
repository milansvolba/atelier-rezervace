import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { invoiceStore } from "@/lib/invoices";

export const dynamic = "force-dynamic";

// GET /api/admin/doklady — fronta „Doklad k vystavení“ (jen admin).
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await invoiceStore.list());
}
