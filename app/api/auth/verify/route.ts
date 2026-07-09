import { NextRequest, NextResponse } from "next/server";
import { users } from "@/lib/users";
import { createSessionToken, verifyMagicLinkToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";

// GET /api/auth/verify?token=... — klik z e-mailu, ověří magic-link token,
// nastaví session cookie a přesměruje do administrace.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/admin?chyba=chybi_token", req.url));

  const email = await verifyMagicLinkToken(token);
  if (!email) return NextResponse.redirect(new URL("/admin?chyba=neplatny_odkaz", req.url));

  const user = await users.byEmail(email);
  if (!user) return NextResponse.redirect(new URL("/admin?chyba=ucet_nenalezen", req.url));

  const session = await createSessionToken(user);
  const res = NextResponse.redirect(new URL("/admin", req.url));
  res.cookies.set(SESSION_COOKIE, session, sessionCookieOptions());
  return res;
}
