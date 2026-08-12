import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { DEFAULT_TEMPLATES, TemplateKey, saveTemplateOverride, resetTemplateOverride } from "@/lib/emailTemplates";

function isValidKey(key: string): key is TemplateKey {
  return key in DEFAULT_TEMPLATES;
}

// PATCH /api/admin/email-templates/:key  { subject, body } — uloží upravený text šablony.
export async function PATCH(req: NextRequest, { params }: { params: { key: string } }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isValidKey(params.key)) return NextResponse.json({ error: "neznámá šablona" }, { status: 404 });

  const { subject, body } = await req.json();
  if (!subject || !body) return NextResponse.json({ error: "chybí předmět nebo text" }, { status: 400 });

  await saveTemplateOverride(params.key, subject, body);
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/email-templates/:key — vrátí šablonu zpátky na výchozí text.
export async function DELETE(req: NextRequest, { params }: { params: { key: string } }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isValidKey(params.key)) return NextResponse.json({ error: "neznámá šablona" }, { status: 404 });

  await resetTemplateOverride(params.key);
  return NextResponse.json({ ok: true });
}
