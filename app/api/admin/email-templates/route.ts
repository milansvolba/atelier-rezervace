import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAllTemplatesForAdmin } from "@/lib/emailTemplates";

// GET /api/admin/email-templates — seznam všech šablon (výchozí + případné úpravy).
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const templates = await getAllTemplatesForAdmin();
  return NextResponse.json(templates);
}
