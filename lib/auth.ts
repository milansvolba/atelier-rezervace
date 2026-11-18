import { NextRequest } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { users } from "@/lib/users";
import { sql, ensureSchema } from "@/lib/db";

// Jmenné účty s přihlášením přes "magic link" e-mailem — žádná hesla se
// nikde neukládají. Session je podepsané JWT v httpOnly cookie (30 dní,
// "zapamatuj toto zařízení"), magic-link token je krátkodobé JWT (15 min)
// poslané v odkazu e-mailem a jde použít jen jednou.
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
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 dní (dřív 90; bezpečnostní audit 2026-11-16, S-04)

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
    // Přihlášení vydaná za dřívější 90denní doby přestanou platit po 30 dnech od vydání.
    if (typeof payload.iat !== "number" || Date.now() / 1000 - payload.iat > SESSION_MAX_AGE_SEC) return null;
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

// Podpis session ještě neříká, že účet existuje a má pořád tu samou roli: smazaný člen nebo admin by jinak zůstal
// přihlášený až do vypršení (90 dní). Proto se účet i role při každém požadavku berou z databáze, ne z tokenu.
// Když databáze selže, přihlášení se bere jako neplatné (bezpečnější než tiše propustit).
export async function getSession(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const claims = await verifySessionToken(token);
  if (!claims || typeof claims.id !== "string") return null;
  try {
    const u = await users.byId(claims.id);
    if (!u) return null;
    return { id: u.id, name: u.name, email: u.email, role: u.role };
  } catch (e) {
    console.error("[auth] Ověření účtu v databázi selhalo:", e);
    return null;
  }
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

// --- Magic-link přihlašovací token (krátkodobý, samostatný od session, jednorázový) ---
export async function createMagicLinkToken(email: string, expiresIn: string = "15m"): Promise<string> {
  return await new SignJWT({ email, purpose: "login" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setJti(crypto.randomUUID())
    .setExpirationTime(expiresIn)
    .sign(secretKey());
}

export interface MagicLinkClaims {
  email: string;
  /** Id odkazu; chybí jen u odkazů poslaných před zavedením jednorázovosti (ty dožijí svou platnost). */
  jti: string | null;
}

export async function verifyMagicLinkToken(token: string): Promise<MagicLinkClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.purpose !== "login" || typeof payload.email !== "string") return null;
    return { email: payload.email, jti: typeof payload.jti === "string" ? payload.jti : null };
  } catch {
    return null;
  }
}

/**
 * Označí odkaz za použitý. true = použit poprvé (přihlášení smí proběhnout), false = už byl použit.
 * Zápis je atomický (PRIMARY KEY), takže dva souběžné požadavky nemají oba uspět.
 * Při chybě databáze vrací false (bezpečnější než propustit odkaz podruhé).
 */
export async function consumeMagicLink(jti: string | null): Promise<boolean> {
  if (!jti) return true; // starý odkaz bez id: platí jako dřív až do vypršení
  try {
    await ensureSchema();
    const rows = await sql`INSERT INTO used_login_tokens (jti) VALUES (${jti}) ON CONFLICT (jti) DO NOTHING RETURNING jti`;
    if (Math.random() < 0.02) {
      // Odkazy platí nejvýše 7 dní, starší záznamy už nejsou potřeba.
      await sql`DELETE FROM used_login_tokens WHERE used_at < now() - interval '8 days'`;
    }
    return rows.length === 1;
  } catch (e) {
    console.error("[auth] Označení odkazu za použitý selhalo:", e);
    return false;
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
