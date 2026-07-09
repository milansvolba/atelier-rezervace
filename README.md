# Atelier na Pobřeží — rezervační systém

Funkční appka podle specifikace (rezervacni-system-specifikace.md): veřejná stránka s obsazeností (týden/měsíc/kvartál/rok) a formulářem žádosti, interní rozhraní se stejným přepínačem pohledů, rychlým modálem pro zapsání rezervace, modálem pro detail/úpravu/smazání existující rezervace a schvalovací frontou, konfliktní logika mezi místy (Okno 1, Stůl 1, Stůl 2, Bar, Pingpong, Klubovna, Ateliér). Běží na rezervace.ateliernapobrezi.cz, propojeno s GitHub repozitářem — každý push do `main` appku automaticky znovu nasadí. Data se ukládají trvale do Neon Postgres.

## Přihlášení a účty

Žádná hesla — přihlášení funguje přes magic link e-mailem (Resend). Zadá se e-mail, appka pošle přihlašovací odkaz platný 15 minut, po kliknutí appka nastaví 90denní cookie ("zapamatuj toto zařízení").

Dvě role:
- **Admin** (zpočátku Milan a Petr, založeni automaticky při prvním běhu) — vidí frontu žádostí ke schválení, spravuje účty (přidávat/odebírat členy v sekci "Účty"), může upravovat/mazat jakoukoli rezervaci.
- **Člen** — vidí stejný rozpis a může si rovnou zapsat vlastní rezervaci (bez schvalování), v sekci "Moje rezervace" ji může sám změnit nebo zrušit. Nevidí frontu žádostí ani správu účtů. Nové členy zakládá admin ručně v sekci "Účty".

Veřejnost (bez účtu) vidí jen agregovanou obsazenost (žádná jména/kontakty), může poslat žádost o pronájem/rezervaci, kterou schvaluje admin.

## E-mailová upozornění

Odesílají se automaticky při: přihlašovacím odkazu, podání veřejné žádosti (adminům i žadateli), schválení/zamítnutí žádosti (žadateli, volitelně s poznámkou od admina), úpravě/smazání rezervace s zaškrtnutým „Informovat rezervistu".

Proměnné prostředí: `RESEND_API_KEY` (odesílání e-mailů), `AUTH_SECRET` (podepisování přihlašovacích tokenů a session — **nutné nastavit na náhodný řetězec**, jinak appka běží na nouzovém výchozím klíči), `ADMIN_EMAILS` (nepovinné, čárkou oddělený seznam pro upozornění na nové žádosti), `NEXT_PUBLIC_APP_URL` (nepovinné, výchozí `https://rezervace.ateliernapobrezi.cz`).

## Co zbývá doladit

- **Sekce pro žádosti o členství** (samoobslužná registrace zájemců) — zatím se noví členové zakládají jen ručně adminem, viz výše. Odloženo, dá se přidat později jako formulář + schvalovací fronta podobná té pro rezervace.
- **Jiný styl e-mailů pro členy** (tykání) oproti veřejnosti (vykání) — zatím všechny šablony vykají, doladit až podle zpětné vazby z testování.

## Struktura kódu

- `lib/types.ts` — datový model a tabulka konfliktů mezi místy
- `lib/calendar.ts` — sdílené pomocné funkce pro práci s daty (týden/měsíc/kvartál/rok)
- `lib/db.ts` — připojení k Neon Postgres (líné, kvůli buildu bez env proměnných) + schéma tabulek
- `lib/data.ts` — úložiště rezervací nad Postgres
- `lib/users.ts` — úložiště účtů nad Postgres
- `lib/auth.ts` — session (JWT cookie) a magic-link tokeny
- `lib/email.ts` — odesílání e-mailů přes Resend
- `app/page.tsx` — veřejná stránka
- `app/admin/page.tsx` — interní rozhraní (admin i členové)
- `app/api/*` — API pro rezervace, žádosti, schvalování, přihlášení a účty
