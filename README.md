# Atelier na Pobřeží — rezervační systém (první verze)

Toto je funkční prototyp podle specifikace (rezervacni-system-specifikace.md): veřejná stránka s obsazeností a formulářem žádosti, interní admin s denní mřížkou míst a schvalovací frontou, konfliktní logika mezi místy (Okno 1, Stůl 1, Stůl 2, Bar, Pingpong, Klubovna, Ateliér).

## Co je zatím "na oko" (demo) a bude potřeba vyměnit

- **Data se neukládají trvale.** Běží jen v paměti serveru — po chvíli nečinnosti nebo novém nasazení zmizí. Až appku začnete používat naostro, je potřeba napojit skutečnou databázi (např. Vercel Postgres — dá se přidat přímo ve Vercel dashboardu v záložce Storage, pár kliknutí).
- **Admin přihlášení je jedno sdílené heslo** (`ADMIN_PASSWORD` v nastavení projektu na Vercelu, výchozí demo heslo je `atelier2026`). Před ostrým provozem vyměnit za jmenné účty Milana a Petra.
- **E-maily se zatím neposílají.** Texty jsou hotové ve specifikaci, kód má na místech `TODO` označeno, kam napojit e-mailovou službu (např. Resend — taky pár kliknutí přes Vercel integrace).

## Jak appku nasadit

1. Rozbalte tenhle zip a obsah složky `app` nahrajte do nového GitHub repozitáře (přes web rozhraní GitHubu — "uploading an existing file", nebo přetažením celé složky).
2. Na vercel.com klikněte "Add New Project", vyberte ten repozitář — Vercel sám pozná, že jde o Next.js, a appku nasadí.
3. Dostanete dočasnou adresu tvaru neco.vercel.app — tu pošlete zpátky, ať appku spolu odladíme.
4. Až bude hotovo, propojíme s doménou rezervace.ateliernapobrezi.cz (jeden DNS záznam).

## Struktura kódu

- `lib/types.ts` — datový model a tabulka konfliktů mezi místy
- `lib/data.ts` — dočasné úložiště rezervací (k výměně za databázi)
- `lib/auth.ts` — dočasné přihlášení adminů (k výměně za jmenné účty)
- `app/page.tsx` — veřejná stránka
- `app/admin/page.tsx` — interní rozhraní
- `app/api/*` — API pro rezervace, žádosti a schvalování
