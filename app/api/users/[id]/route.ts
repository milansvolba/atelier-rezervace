import { NextRequest, NextResponse } from "next/server";
import { users } from "@/lib/users";
import { requireAdmin } from "@/lib/auth";

// DELETE /api/users/:id — odebrat účet (jen admin, nejde smazat posledního admina)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const target = await users.byId(params.id);
  if (!target) return NextResponse.json({ error: "účet nenalezen" }, { status: 404 });
  if (target.role === "admin") {
    const all = await users.all();
    const adminCount = all.filter((u) => u.role === "admin").length;
    if (adminCount <= 1) {
      return NextResponse.json({ error: "Nejde smazat posledního admina." }, { status: 400 });
    }
  }
  await users.remove(params.id);
  return NextResponse.json({ ok: true });
}
