import { NextRequest, NextResponse } from "next/server";
import { invoiceStore } from "@/lib/invoices";
import { sendInvoiceReminderEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// GET /api/cron/doklady-pripominka — denně spouští Vercel Cron (viz vercel.json).
// Pošle souhrn dokladů, které ještě nejsou odškrtnuté jako vystavené. Chráněno proměnnou CRON_SECRET:
// Vercel ji posílá v hlavičce Authorization: Bearer ...; bez nastavené proměnné endpoint nic neudělá.
const MIN_AGE_HOURS = 20; // položky z posledních ~20 hodin už dostaly e-mail hned po platbě, ať nechodí dvakrát

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET není nastavený" }, { status: 503 });
  if (req.headers.get("authorization") !== "Bearer " + secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { open } = await invoiceStore.list();
  const cutoff = Date.now() - MIN_AGE_HOURS * 3600 * 1000;
  const due = open.filter((i) => !i.paidAt || new Date(i.paidAt).getTime() < cutoff);
  await sendInvoiceReminderEmail(due);
  return NextResponse.json({ open: open.length, reminded: due.length });
}
