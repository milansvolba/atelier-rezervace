import { neon, NeonQueryFunction } from "@neondatabase/serverless";

// Lazy inicializace — modul se nesmí pokusit připojit k databázi hned při
// načtení (to by shodilo `next build`, který soubory jen prochází bez env proměnných).
let client: NeonQueryFunction<false, false> | null = null;

function getSql() {
  if (!client) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error("Chybí DATABASE_URL / POSTGRES_URL — databáze není nastavená.");
    client = neon(url);
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
    })();
  }
  return ready;
}
