# Atelier na Pobřeží — rezervační systém

Funkční prototyp podle specifikace (rezervacni-system-specifikace.md): veřejná stránka s obsazeností (týden/měsíc/kvartál/rok) a formulářem žádosti, interní admin se stejným přepínačem pohledů, rychlým modálem pro zapsání rezervace a schvalovací frontou, konfliktní logika mezi místy (Okno 1, Stůl 1, Stůl 2, Bar, Pingpong, Klubovna, Ateliér). Běží na atelier-rezervace.vercel.app, propojeno s GitHub repozitářem — každý push do `main` appku automaticky znovu nasadí.

## Co je zatím "na oko" (demo) a bude potřeba vyměnit

- **Data se neukládají trvale.** Běží jen v paměti serveru — po chvíli nečinnosti nebo novém nasazení zmizí. Až appku začnete používat naostro, je potřeba napojit skutečnou databázi (např. Vercel Postgres — dá se přidat přímo ve Vercel dashboardu v záložce Storage, pár kliknutí).
- **Přihlášení je jedno sdílené heslo** (`ADMIN_PASSWORD` v nastavení projektu na Vercelu, výchozí demo heslo je `atelier2026`). Před ostrým provozem vyměnit za jmenné účty:
  - **Admini** (Milan, Petr) — plný přístup, schvalovací fronta, zakládají i další účty.
  - **Členové klubu/coworkingu** — nižší oprávnění, mohou zakládat vlastní rezervace (zatím nedořešeno jestli rovnou potvrzené nebo čekající na schválení admina), ale nevidí frontu žádostí ani nemohou zakládat jiné účty. Admin je bude zakládat ručně, případně přes formulář žádosti o členství, který admin schválí. **Odloženo na později, až bude odladěné demo.**
- **E-maily se zatím neposílají.** Texty jsou hotové ve specifikaci, kód má na místech `TODO` označeno, kam napojit e-mailovou službu (např. Resend — taky pár kliknutí přes Vercel integrace).

## Struktura kódu

- `lib/types.ts` — datový model a tabulka konfliktů mezi místy
- `lib/calendar.ts` — sdílené pomocné funkce pro práci s daty (týden/měsíc/kvartál/rok)
- `lib/data.ts` — dočasné úložiště rezervací (k výměně za databázi)
- `lib/auth.ts` — dočasné přihlášení (k výměně za jmenné účty s rolemi)
- `app/page.tsx` — veřejná stránka
- `app/admin/page.tsx` — interní rozhraní
- `app/api/*` — API pro rezervace, žádosti a schvalování
