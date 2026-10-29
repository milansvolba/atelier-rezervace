import { NextRequest, NextResponse } from "next/server";
import { fetchAres } from "@/lib/ares";
import { icoValid, normalizeIco } from "@/lib/billingInput";

export const dynamic = "force-dynamic";

// GET /api/ares?ico=12345678 — veřejné doplnění údajů o firmě z ARES do formuláře (vyplnění si zákazník může upravit).
export async function GET(req: NextRequest) {
  const ico = normalizeIco(req.nextUrl.searchParams.get("ico") ?? "");
  if (!icoValid(ico)) return NextResponse.json({ error: "neplatné IČO" }, { status: 400 });
  try {
    const c = await fetchAres(ico);
    if (!c) return NextResponse.json({ error: "firma nenalezena" }, { status: 404 });
    return NextResponse.json(c);
  } catch {
    return NextResponse.json({ error: "ARES je teď nedostupný" }, { status: 502 });
  }
}
