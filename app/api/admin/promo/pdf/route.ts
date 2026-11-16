import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { promoStore } from "@/lib/promo";
import { generatePromoSheetPdf } from "@/lib/promoPdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/admin/promo/pdf?label=NÁZEV nebo ?ids=id1,id2 — tisková stránka kupónů (4 na A4), jen pro správce.
// Posílají se jen nepoužité kódy (aktivní nebo rezervované); použité a zrušené se do tisku nedávají.
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Přístup jen pro správce." }, { status: 403 });
  const url = new URL(req.url);
  const label = url.searchParams.get("label");
  const ids = (url.searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 500);
  const list = label ? await promoStore.byLabel(label) : await promoStore.byIds(ids);
  const printable = list.filter((p) => p.status === "active" || p.status === "reserved");
  if (printable.length === 0) return NextResponse.json({ error: "Není co tisknout (žádný nepoužitý kód)." }, { status: 404 });
  const pdf = await generatePromoSheetPdf(printable);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="slevove-kupony.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
