import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { store } from "@/lib/data";
import { voucherStore } from "@/lib/vouchers";
import { generateVoucherPdf, voucherPdfFilename } from "@/lib/voucherPdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/vouchers/pdf?t=TOKEN — kupující si stáhne PDF poukazu z odkazu v e-mailu (tajný token, ne kód poukazu).
// GET /api/vouchers/pdf?id=ID — admin si stáhne PDF libovolného poukazu.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t");
  const id = req.nextUrl.searchParams.get("id");
  let v = null;
  if (token) {
    v = await voucherStore.byManageToken(token);
  } else if (id) {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    v = await voucherStore.byId(id);
  }
  if (!v) return NextResponse.json({ error: "Odkaz není platný." }, { status: 404 });
  const booking = v.bookingId ? (await store.all()).find((b) => b.id === v.bookingId) : undefined;
  try {
    const pdf = await generateVoucherPdf(v, booking);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${voucherPdfFilename(v)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[voucher] PDF poukazu " + v.code + " se nepodařilo vytvořit:", e);
    return NextResponse.json({ error: "PDF se nepodařilo vytvořit." }, { status: 500 });
  }
}
