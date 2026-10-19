import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { users } from "@/lib/users";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ user: null });
  // Členství zdarma se bere z databáze (v přihlašovacím tokenu není).
  let membershipFree = false;
  try {
    const u = await users.byId(session.id);
    membershipFree = !!u?.membershipFree;
  } catch {
    // když databáze selže, přihlášení nerozbijeme
  }
  return NextResponse.json({ user: { ...session, membershipFree } });
}
