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
  membershipFree: boolean; // členství zdarma (guestlist): bez platby, bez odkazu na platbu
  membershipEndsAt: string | null; // zrušené předplatné doběhne k tomuto datu
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
    membershipFree: !!r.membership_free,
    membershipEndsAt: r.membership_ends_at
      ? typeof r.membership_ends_at === "string"
        ? (r.membership_ends_at as string)
        : (r.membership_ends_at as Date).toISOString()
      : null,
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

  async add(u: { name: string; email: string; role: Role; free?: boolean }): Promise<AppUser> {
    await ensureSchema();
    const id = crypto.randomUUID();
    const email = u.email.toLowerCase().trim();
    const free = !!u.free;
    await sql`INSERT INTO users (id, name, email, role, membership_free) VALUES (${id}, ${u.name}, ${email}, ${u.role}, ${free})`;
    return {
      id,
      name: u.name,
      email,
      role: u.role,
      createdAt: new Date().toISOString(),
      membershipStatus: "none",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      membershipFree: free,
      membershipEndsAt: null,
    };
  },

  async setFree(id: string, free: boolean): Promise<void> {
    await ensureSchema();
    await sql`UPDATE users SET membership_free = ${free} WHERE id = ${id}`;
  },

  // Datum, kdy zrušené (ale ještě zaplacené) předplatné skončí; null = nezrušeno.
  async setMembershipEnd(id: string, endsAt: string | null): Promise<void> {
    await ensureSchema();
    await sql`UPDATE users SET membership_ends_at = ${endsAt}::timestamptz WHERE id = ${id}`;
  },

  // Uloží konec členství a vrátí true jen tehdy, když zrušení dosud nebylo zaznamenané (konec byl prázdný).
  // Podle toho se pošle e-mail o zrušení jen jednou, i když Stripe pošle událost opakovaně.
  async setMembershipEndIfNew(id: string, endsAt: string): Promise<boolean> {
    await ensureSchema();
    const rows = await sql`UPDATE users SET membership_ends_at = ${endsAt}::timestamptz
      WHERE id = ${id} AND membership_ends_at IS NULL RETURNING id`;
    if (rows.length > 0) return true;
    await sql`UPDATE users SET membership_ends_at = ${endsAt}::timestamptz WHERE id = ${id}`;
    return false;
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

  // Jednorázově „zabere“ právo poslat uvítací e-mail po první platbě. Vrací true jen poprvé
  // (opakované doručení webhooku nebo druhá faktura už e-mail neposlou).
  async claimWelcomeSent(id: string): Promise<boolean> {
    await ensureSchema();
    const rows = await sql`UPDATE users SET membership_welcome_sent_at = now()
      WHERE id = ${id} AND membership_welcome_sent_at IS NULL RETURNING id`;
    return rows.length > 0;
  },

  async remove(id: string): Promise<void> {
    await ensureSchema();
    await sql`DELETE FROM users WHERE id = ${id}`;
  },
};
