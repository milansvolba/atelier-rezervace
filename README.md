# Atelier na Pobřeží — rezervační systém

Funkční appka podle specifikace (rezervacni-system-specifikace.md): veřejná stránka s obsazeností (týden/měsíc/kvartál/rok) a formulářem žádosti, interní admin se stejným přepínačem pohledů, rychlým modálem pro zapsání rezervace, modálem pro detail/úpravu/smazání existující rezervace a schvalovací frontou, konfliktní logika mezi místy (Okno 1, Stůl 1, Stůl 2, Bar, Pingpong, Klubovna, Ateliér). Běží na rezervace.ateliernapobrezi.cz, propojeno s GitHub repozitářem — každý push do `main` appku automaticky znovu nasadí. Data se ukládají trvale do Neon Postgres (napojeno přes Vercel integraci).

## Co je zatím "na oko" (demo) a bude potřeba vyměnit

- **Přihlášení je jedno sdílené heslo** (`ADMIN_PASSWORD` v nastavení projektu na Vercelu, výchozí demo heslo je `atelier2026`). Před ostrým provozem vyměnit za jmenné účty:
  - **Admini** (Milan, Petr) — plný přístup, schvalovací fronta, zakládají i další účty.
  - **Členové klubu/coworkingu** — nižší oprávnění, mohou zakládat/upravovat vlastní rezervace, ale nevidí frontu žádostí ani nemohou zakládat jiné účty. Admin je bude zakládat ručně, případně přes formulář žádosti o členství, který admin schválí. **Odloženo na později, až bude odladěné demo.**
- **E-maily jsou zapojené v kódu (`lib/email.ts`, Resend), ale reálně se odešlou až po nastavení `RESEND_API_KEY`** v proměnných prostředí na Vercelu a ověření odesílací domény (rezervace@ateliernapobrezi.cz) v Resendu. Bez klíče appka jen zaloguje, že by e-mail odeslala, a normálně pokračuje dál (žádost/rezervace se nezablokuje).

## E-mailová upozornění

Odesílají se automaticky při:
- podání veřejné žádosti → adminům (`ADMIN_EMAILS`, výchozí Milan + Petr) upozornění s odkazem do administrace, žadateli potvrzení přijetí
- schválení/zamítnutí žádosti adminem → žadateli výsledek
- úpravě nebo smazání existující rezervace adminem, pokud zaškrtne „Informovat rezervistu" → kontaktu u rezervace

Proměnné prostředí: `RESEND_API_KEY` (povinné pro reálné odesílání), `ADMIN_EMAILS` (nepovinné, čárkou oddělený seznam), `NEXT_PUBLIC_APP_URL` (nepovinné, výchozí `https://rezervace.ateliernapobrezi.cz`).

## Struktura kódu

- `lib/types.ts` — datový model a tabulka konfliktů mezi místy
- `lib/calendar.ts` — sdílené pomocné funkce pro práci s daty (týden/měsíc/kvartál/rok)
- `lib/db.ts` — připojení k Neon Postgres (líné, kvůli buildu bez env proměnných)
- `lib/data.ts` — úložiště rezervací nad Postgres
- `lib/auth.ts` — dočasné přihlášení (k výměně za jmenné účty s rolemi)
- `lib/email.ts` — odesílání e-mailů přes Resend
- `app/page.tsx` — veřejná stránka
- `app/admin/page.tsx` — interní rozhraní
- `app/api/*` — API pro rezervace, žádosti a schvalování
