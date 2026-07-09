import { NextRequest, NextResponse } from "next/server";
import { users } from "@/lib/users";
import { createMagicLinkToken } from "@/lib/auth";
import { sendMagicLinkEmail } from "@/lib/email";

// POST /api/auth/request-link { email } — pošle přihlašovací odkaz, pokud e-mail patří
// existujícímu účtu (admini jsou nasazeni automaticky, členy zakládá admin ručně).
export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "chybí e-mail" }, { status: 400 });

  const user = await users.byEmail(email);
  if (!user) {
    return NextResponse.json(
      { error: "Tento e-mail v systému nemáme. Ozvěte se Milanovi nebo Petrovi." },
      { status: 404 }
    );
  }

  const token = await createMagicLinkToken(user.email);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://rezervace.ateliernapobrezi.cz";
  const link = `${appUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;
  await sendMagicLinkEmail(user, link);

  return NextResponse.json({ ok: true });
}
