import { sql, ensureSchema } from "./db";

export type Role = "admin" | "member";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

function rowToUser(r: Record<string, unknown>): AppUser {
  const created = r.created_at as string | Date;
  return {
    id: r.id as string,
    name: r.name as string,
    email: r.email as string,
    role: r.role as Role,
    createdAt: typeof created === "string" ? created : created.toISOString(),
  };
}

export const users = {
  async all(): Promise<AppUser[]> {
    await ensureSchema();
    const rows = await sql`SELECT * FROM users ORDER BY role, name`;
    return rows.map(rowToUser);
  },

  async byEmail(email: string): Promise<AppUser | null> {
    await ensureSchema();
    const rows = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase().trim()}`;
    return rows[0] ? rowToUser(rows[0]) : null;
  },

  async byId(id: string): Promise<AppUser | null> {
    await ensureSchema();
    const rows = await sql`SELECT * FROM users WHERE id = ${id}`;
    return rows[0] ? rowToUser(rows[0]) : null;
  },

  async add(u: { name: string; email: string; role: Role }): Promise<AppUser> {
    await ensureSchema();
    const id = crypto.randomUUID();
    const email = u.email.toLowerCase().trim();
    await sql`INSERT INTO users (id, name, email, role) VALUES (${id}, ${u.name}, ${email}, ${u.role})`;
    return { id, name: u.name, email, role: u.role, createdAt: new Date().toISOString() };
  },

  async remove(id: string): Promise<void> {
    await ensureSchema();
    await sql`DELETE FROM users WHERE id = ${id}`;
  },
};
