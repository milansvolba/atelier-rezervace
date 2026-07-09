import { NextRequest, NextResponse } from "next/server";
import { users } from "@/lib/users";
import { requireAdmin } from "@/lib/auth";

// GET /api/users — seznam účtů (jen admin)
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await users.all());
}

// POST /api/users { name, email, role } — ručně založit nového admina/člena (jen admin)
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { name, email, role } = await req.json();
  if (!name || !email || (role !== "admin" && role !== "member")) {
    return NextResponse.json({ error: "chybí jméno, e-mail nebo neplatná role" }, { status: 400 });
  }
  const existing = await users.byEmail(email);
  if (existing) return NextResponse.json({ error: "tento e-mail už účet má" }, { status: 409 });
  const user = await users.add({ name, email, role });
  return NextResponse.json(user, { status: 201 });
}
