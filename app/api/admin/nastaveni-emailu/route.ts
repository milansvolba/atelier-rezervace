import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, sameOriginOk } from "@/lib/auth";
import { getRecipientSettings, saveRecipients } from "@/lib/settings";
import { MAX_RECIPIENTS, RECIPIENT_GROUPS, RecipientGroup, parseEmailList } from "@/lib/recipients";

// GET /api/admin/nastaveni-emailu — komu se právě teď posílají e-maily správy (jen admin).
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const settings = await getRecipientSettings();
  return NextResponse.json(
    RECIPIENT_GROUPS.map((g) => ({ ...g, ...settings.find((s) => s.group === g.key)! }))
  );
}

// PUT /api/admin/nastaveni-emailu  { group, emails }  — uloží příjemce jedné skupiny.
// Prázdný seznam vrátí záložní hodnotu (nastavení ve Vercelu).
export async function PUT(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!sameOriginOk(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { group?: string; emails?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 });
  }
  const group = RECIPIENT_GROUPS.find((g) => g.key === body.group)?.key as RecipientGroup | undefined;
  if (!group) return NextResponse.json({ error: "Neznámá skupina příjemců." }, { status: 400 });

  const { emails, invalid } = parseEmailList(String(body.emails ?? ""));
  if (invalid.length) {
    return NextResponse.json({ error: "Tohle nevypadá jako e-mailová adresa: " + invalid.slice(0, 3).join(", ") }, { status: 400 });
  }
  if (emails.length > MAX_RECIPIENTS) {
    return NextResponse.json({ error: `Nejvýš ${MAX_RECIPIENTS} adres.` }, { status: 400 });
  }

  await saveRecipients(group, emails, admin.email);
  return NextResponse.json({ ok: true });
}
