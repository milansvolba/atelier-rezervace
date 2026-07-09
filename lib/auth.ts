import { NextRequest } from "next/server";
import { SignJWT, jwtVerify } from "jose";

// Jmenné účty s přihlášením přes "magic link" e-mailem — žádná hesla se
// nikde neukládají. Session je podepsané JWT v httpOnly cookie (90 dní,
// "zapamatuj toto zařízení"), magic-link token je krátkodobé JWT (15 min)
// poslané v odkazu e-mailem.
//
// AUTH_SECRET musí být nastavený ve Vercel Environment Variables — bez něj
// appka běží jen s nouzovým lokálním klíčem (nepoužívat takhle naostro).
function secretKey() {
  const secret = process.env.AUTH_SECRET || "dev-insecure-secret-change-me";
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
export async function createMagicLinkToken(email: string): Promise<string> {
  return await new SignJWT({ email, purpose: "login" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
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
