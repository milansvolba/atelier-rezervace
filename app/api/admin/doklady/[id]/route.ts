import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { invoiceStore } from "@/lib/invoices";

export const dynamic = "force-dynamic";

// PATCH /api/admin/doklady/:id — { action: "issued" | "reopen" | "correction_done", number?: string }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { action?: string; number?: string };
  if (body.action === "issued") await invoiceStore.markIssued(params.id, body.number);
  else if (body.action === "reopen") await invoiceStore.reopen(params.id);
  else if (body.action === "correction_done") await invoiceStore.correctionDone(params.id);
  else return NextResponse.json({ error: "neznámá akce" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
