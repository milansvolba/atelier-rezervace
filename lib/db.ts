import { neon, NeonQueryFunction } from "@neondatabase/serverless";

// Lazy inicializace — modul se nesmí pokusit připojit k databázi hned při
// načtení (to by shodilo `next build`, který soubory jen prochází bez env proměnných).
let client: NeonQueryFunction<false, false> | null = null;

function getSql() {
  if (!client) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error("Chybí DATABASE_URL / POSTGRES_URL — databáze není nastavená.");
    client = neon(url, { fetchOptions: { cache: "no-store" } });
  }
  return client;
}

// Tenký wrapper, který se chová jako tagged template `sql\`...\`` stejně jako
// přímé volání neon() — jen odloží připojení až na první opravdové dotazy.
export function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  return getSql()(strings, ...values);
}

// Vytvoří tabulky, pokud ještě neexistují. Volá se líně před každým přístupem
// k datům, takže není potřeba samostatný migrační krok.
let ready: Promise<void> | null = null;

export function ensureSchema() {
  if (!ready) {
    ready = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS bookings (
          id text PRIMARY KEY,
          resource text NOT NULL,
          date date NOT NULL,
          start_time text NOT NULL,
          end_time text NOT NULL,
          title text NOT NULL,
          requester_name text,
          requester_contact text,
          note text,
          status text NOT NULL,
          source text NOT NULL,
          extra_monitor boolean NOT NULL DEFAULT false,
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `;
      await sql`CREATE INDEX IF NOT EXISTS bookings_date_idx ON bookings (date);`;
      await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS user_id text;`;
      await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'pronajem';`;
      await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS capacity integer;`;
      await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS price integer;`;

      await sql`
        CREATE TABLE IF NOT EXISTS course_signups (
          id text PRIMARY KEY,
          booking_id text NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
          name text NOT NULL,
          contact text NOT NULL,
          people integer NOT NULL DEFAULT 1,
          note text,
          status text NOT NULL DEFAULT 'pending',
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `;
      await sql`CREATE INDEX IF NOT EXISTS course_signups_booking_idx ON course_signups (booking_id);`;

      // Online platby přes Stripe Checkout (viz lib/stripe.ts). id = ID Stripe Checkout Session.
// Slouží k dočasnému držení míst během platby a k idempotenci webhooku.
await sql`
CREATE TABLE IF NOT EXISTS payments (
id text PRIMARY KEY,
booking_id text NOT NULL,
people integer NOT NULL DEFAULT 1,
status text NOT NULL DEFAULT 'awaiting',
created_at timestamptz NOT NULL DEFAULT now()
);
`;

await sql`
        CREATE TABLE IF NOT EXISTS users (
          id text PRIMARY KEY,
          name text NOT NULL,
          email text NOT NULL UNIQUE,
          role text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `;
      await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_intent text`;
      await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_czk integer`;
      await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS signup_id text`;
      await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS refunded_czk integer NOT NULL DEFAULT 0`;
      // Dárkové poukazy na kurzy (kód, platnost 1 rok, stav active/redeemed)
      await sql`
        CREATE TABLE IF NOT EXISTS vouchers (
          id text PRIMARY KEY,
          code text NOT NULL UNIQUE,
          topic text NOT NULL,
          course_title text NOT NULL,
          booking_id text,
          people integer NOT NULL DEFAULT 1,
          casting boolean NOT NULL DEFAULT false,
          amount_czk integer NOT NULL,
          buyer_name text NOT NULL,
          buyer_email text NOT NULL,
          recipient_name text,
          message text,
          status text NOT NULL DEFAULT 'active',
          stripe_session text,
          created_at timestamptz NOT NULL DEFAULT now(),
          expires_at timestamptz NOT NULL,
          redeemed_at timestamptz
        );
      `;
      // Příznaky termínů kurzů (zatím jen: firemní akce, která se neukazuje veřejně na /kurzy).
      await sql`
        CREATE TABLE IF NOT EXISTS course_flags (
          booking_id text PRIMARY KEY,
          corporate boolean NOT NULL DEFAULT false
        )
      `;
      // Členství (platba předplatného přes Stripe): stav a Stripe identifikátory u účtu.
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_status text NOT NULL DEFAULT 'none'`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id text`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id text`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_free boolean NOT NULL DEFAULT false`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_ends_at timestamptz`;
      // Počáteční admini podle specifikace — jde jen o seed, ON CONFLICT nic nepřepíše,
      // pokud si e-mail nebo roli později v adminu upravíte.
      await sql`
        INSERT INTO users (id, name, email, role)
        VALUES
          (${crypto.randomUUID()}, 'Milan', 'milan.svolba@gmail.com', 'admin'),
          (${crypto.randomUUID()}, 'Petr', 'petr.svolba@gmail.com', 'admin')
        ON CONFLICT (email) DO NOTHING
      `;

      // Upravené texty e-mailových šablon (přepisují výchozí texty v kódu, viz lib/emailTemplates.ts).
      await sql`
        CREATE TABLE IF NOT EXISTS email_templates (
          key text PRIMARY KEY,
          subject text NOT NULL,
          body text NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        );
      `;

      // Log každého pokusu o odeslání e-mailu — pro přehled v adminu.
      await sql`
        CREATE TABLE IF NOT EXISTS email_log (
          id text PRIMARY KEY,
          type text NOT NULL,
          recipient text NOT NULL,
          subject text NOT NULL,
          booking_id text,
          signup_id text,
          status text NOT NULL,
          error text,
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `;
      await sql`CREATE INDEX IF NOT EXISTS email_log_created_idx ON email_log (created_at DESC);`;

      await sql`
        CREATE TABLE IF NOT EXISTS discount_tiers (
          id text PRIMARY KEY,
          min_fill_percent integer NOT NULL,
          discount_percent integer NOT NULL,
          sort_order integer NOT NULL DEFAULT 0,
          updated_at timestamptz NOT NULL DEFAULT now()
        );
      `;
      const existingTiers = await sql`SELECT COUNT(*)::int AS count FROM discount_tiers`;
      if (Number(existingTiers[0]?.count ?? 0) === 0) {
        await sql`
          INSERT INTO discount_tiers (id, min_fill_percent, discount_percent, sort_order) VALUES
            (${crypto.randomUUID()}, 100, 30, 1),
            (${crypto.randomUUID()}, 83, 20, 2),
            (${crypto.randomUUID()}, 67, 15, 3)
        `;
      }
    })();
  }
  return ready;
}
