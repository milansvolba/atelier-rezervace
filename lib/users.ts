import { sql, ensureSchema } from "./db";

export type Role = "admin" | "member";

// Stav členství (předplatné ve Stripe): none = bez předplatného, active, past_due = platba selhala, canceled.
export type MembershipStatus = "none" | "active" | "past_due" | "canceled";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  membershipStatus: MembershipStatus;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

function rowToUser(r: Record<string, unknown>): AppUser {
  const created = r.created_at as string | Date;
  return {
    id: r.id as string,
    name: r.name as string,
    email: r.email as string,
    role: r.role as Role,
    createdAt: typeof created === "string" ? created : created.toISOString(),
    membershipStatus: ((r.membership_status as string) || "none") as MembershipStatus,
    stripeCustomerId: (r.stripe_customer_id as string | null) ?? null,
    stripeSubscriptionId: (r.stripe_subscription_id as string | null) ?? null,
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

  async byStripeCustomer(customerId: string): Promise<AppUser | null> {
    await ensureSchema();
    const rows = await sql`SELECT * FROM users WHERE stripe_customer_id = ${customerId}`;
    return rows[0] ? rowToUser(rows[0]) : null;
  },

  async add(u: { name: string; email: string; role: Role }): Promise<AppUser> {
    await ensureSchema();
    const id = crypto.randomUUID();
    const email = u.email.toLowerCase().trim();
    await sql`INSERT INTO users (id, name, email, role) VALUES (${id}, ${u.name}, ${email}, ${u.role})`;
    return {
      id,
      name: u.name,
      email,
      role: u.role,
      createdAt: new Date().toISOString(),
      membershipStatus: "none",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    };
  },

  // Nastaví stav členství; Stripe identifikátory se přepíšou jen když jsou zadané.
  async setMembership(
    id: string,
    p: { status: MembershipStatus; customerId?: string; subscriptionId?: string }
  ): Promise<void> {
    await ensureSchema();
    await sql`UPDATE users SET
      membership_status = ${p.status},
      stripe_customer_id = COALESCE(${p.customerId ?? null}::text, stripe_customer_id),
      stripe_subscription_id = COALESCE(${p.subscriptionId ?? null}::text, stripe_subscription_id)
      WHERE id = ${id}`;
  },

  async remove(id: string): Promise<void> {
    await ensureSchema();
    await sql`DELETE FROM users WHERE id = ${id}`;
  },
};
