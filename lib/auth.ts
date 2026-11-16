import { NextRequest } from "next/server";
import { SignJWT, jwtVerify } from "jose";

// Jmenné účty s přihlášením přes "magic link" e-mailem — žádná hesla se
// nikde neukládají. Session je podepsané JWT v httpOnly cookie (90 dní,
// "zapamatuj toto zařízení"), magic-link token je krátkodobé JWT (15 min)
// poslané v odkazu e-mailem.
//
// AUTH_SECRET musí být nastavený ve Vercel Environment Variables (Production i Preview). Bez něj aplikace
// na serveru (NODE_ENV=production, tj. i Vercel náhledy) odmítne podepisovat a ověřovat přihlášení: veřejný záložní
// klíč by dovolil komukoli vyrobit si správcovské přihlášení. Záložní klíč zůstává jen pro lokální vývoj.
function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL) throw new Error("Chybí AUTH_SECRET.");
    return new TextEncoder().encode("dev-insecure-secret-change-me");
  }
  return new TextEncoder().encode(secret);
}

export const SESSION_COOKIE = "atelier_session";
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 90; // 90 dní

export type Role = "admin" | "member";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return await new SignJWT({ id: user.id, name: user.name, email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SEC}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return {
      id: payload.id as string,
      name: payload.name as string,
      email: payload.email as string,
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

export async function getSession(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

// Vrátí přihlášeného uživatele, pokud je admin — jinak null.
export async function requireAdmin(req: NextRequest): Promise<SessionUser | null> {
  const session = await getSession(req);
  return session && session.role === "admin" ? session : null;
}

// Vrátí jakéhokoli přihlášeného uživatele (admin i člen) — jinak null.
export async function requireUser(req: NextRequest): Promise<SessionUser | null> {
  return getSession(req);
}

// Ochrana proti CSRF u změn v administraci: požadavek z prohlížeče musí přijít z téhož webu (hlavička Origin).
// Cookie má SameSite=Lax, ale hlavní web ateliéru sdílí doménu, proto kontrolujeme navíc i původ a typ obsahu.
export function sameOriginOk(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.get("host")) return false;
    } catch {
      return false;
    }
  }
  const ct = req.headers.get("content-type") || "";
  return ct.toLowerCase().includes("application/json");
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: SESSION_MAX_AGE_SEC,
    path: "/",
  };
}

// --- Magic-link přihlašovací token (krátkodobý, samostatný od session) ---
export async function createMagicLinkToken(email: string, expiresIn: string = "15m"): Promise<string> {
  return await new SignJWT({ email, purpose: "login" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey());
}

export async function verifyMagicLinkToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.purpose !== "login" || typeof payload.email !== "string") return null;
    return payload.email;
  } catch {
    return null;
  }
}


// --- Token platebního odkazu na členství (v uvítacím e-mailu; platí 30 dní, jde jen k založení předplatného) ---
export async function createPayToken(userId: string): Promise<string> {
  return await new SignJWT({ userId, purpose: "pay" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
}

export async function verifyPayToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.purpose !== "pay" || typeof payload.userId !== "string") return null;
    return payload.userId;
  } catch {
    return null;
  }
}
