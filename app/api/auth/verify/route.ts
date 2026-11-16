import { NextRequest, NextResponse } from "next/server";
import { users } from "@/lib/users";
import { createSessionToken, verifyMagicLinkToken, consumeMagicLink, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";

// Přihlášení odkazem z e-mailu je dvoukrokové a odkaz jde použít jen jednou:
//  1) GET  /api/auth/verify?token=... — jen ukáže stránku s tlačítkem „Přihlásit se“. Nic se nespotřebuje, takže
//     poštovní skenery a náhledy odkazů (které odkaz jen otevřou) uživatelův odkaz nespálí.
//  2) POST /api/auth/verify — po kliknutí na tlačítko ověří token, označí ho za použitý, nastaví session cookie a
//     přesměruje do administrace.
// Bezpečnostní audit 2026-11-16 (S-04).

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function page(inner: string, status = 200) {
  const html = `<!DOCTYPE html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Přihlášení — Ateliér na pobřeží</title><style>body{font-family:-apple-system,"Segoe UI",sans-serif;background:#faf7f2;color:#26302c;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px}.box{background:#fff;border:1px solid #e2dcd0;border-radius:12px;padding:28px;max-width:380px;text-align:center}h1{font-size:1.25rem;margin:0 0 10px}p{color:#555;font-size:.95rem;line-height:1.5}button,a.btn{display:inline-block;background:#2f4a4a;color:#fff;border:0;padding:12px 26px;border-radius:999px;font-size:1rem;cursor:pointer;text-decoration:none;margin-top:8px}</style></head><body><div class="box">${inner}</div></body></html>`;
  return new NextResponse(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/admin?chyba=chybi_token", req.url));

  const claims = await verifyMagicLinkToken(token);
  if (!claims) return NextResponse.redirect(new URL("/admin?chyba=neplatny_odkaz", req.url));

  return page(`<h1>Přihlášení do rezervací</h1><p>Pro přihlášení klikněte na tlačítko. Odkaz jde použít jen jednou.</p><form method="post" action="/api/auth/verify"><input type="hidden" name="token" value="${esc(token)}"><button type="submit">Přihlásit se</button></form>`);
}

export async function POST(req: NextRequest) {
  let token = "";
  try {
    const form = await req.formData();
    token = String(form.get("token") || "");
  } catch {
    return NextResponse.redirect(new URL("/admin?chyba=chybi_token", req.url), 303);
  }
  if (!token) return NextResponse.redirect(new URL("/admin?chyba=chybi_token", req.url), 303);

  const claims = await verifyMagicLinkToken(token);
  if (!claims) return NextResponse.redirect(new URL("/admin?chyba=neplatny_odkaz", req.url), 303);

  const user = await users.byEmail(claims.email);
  if (!user) return NextResponse.redirect(new URL("/admin?chyba=ucet_nenalezen", req.url), 303);

  if (!(await consumeMagicLink(claims.jti))) {
    return page(`<h1>Odkaz už byl použit</h1><p>Každý přihlašovací odkaz funguje jen jednou. Požádejte prosím o nový na přihlašovací stránce.</p><a class="btn" href="/admin">Na přihlášení</a>`, 410);
  }

  const session = await createSessionToken(user);
  const res = NextResponse.redirect(new URL("/admin", req.url), 303);
  res.cookies.set(SESSION_COOKIE, session, sessionCookieOptions());
  return res;
}
