# Rezervační systém (atelier-rezervace)

Next.js 14 appka na `rezervace.ateliernapobrezi.cz`. Spravuje obsazenost prostoru ateliéru (pronájmy) a vypsané termíny kurzů, včetně veřejných žádostí/přihlášek a interního schvalování.

- Repozitář: GitHub `milansvolba/atelier-rezervace`, větev `main`.
- Nasazení: Vercel, propojeno s GitHubem — každý push do `main` appku automaticky znovu nasadí. Žádný ruční deploy krok.
- Editace kódu: přes webový editor GitHubu (CodeMirror) přímo v prohlížeči — není k dispozici přímý git/push nástroj v tomto prostředí.
- Databáze: Neon Postgres, připojení přes `@neondatabase/serverless` (HTTP driver, funguje i v serverless prostředí Vercelu).
- E-maily: Resend.

## Datový model

Jeden centrální typ **`Booking`** (`lib/types.ts`) pokrývá jak pronájmy prostoru, tak termíny kurzů — rozlišené polem `category`:

- `category: "pronajem"` — klasická rezervace fyzického místa/prostoru.
- `category: "kurz"` — veřejně vypsaný termín kurzu, navíc má `capacity` (kapacita) a `price` (cena za osobu v Kč).

Sedm rezervovatelných "produktů" (`ResourceId`): `atelier`, `klubovna`, `pingpong`, `okno1`, `stul1`, `stul2`, `bar`. `atelier` a `klubovna` jsou skupinové produkty, které při rezervaci blokují víc fyzických míst najednou — přesná tabulka konfliktů mezi zdroji je explicitně vyjmenovaná v `CONFLICTS` (ne odvozená geometricky).

Stav rezervace (`BookingStatus`): `confirmed` (potvrzená, blokuje termín) / `pending` (čeká na schválení, zatím nic neblokuje) / `rejected`. Původ (`BookingSource`): `admin` / `member` / `public`.

**`CourseSignup`** — přihláška účastníka na konkrétní vypsaný termín kurzu (`bookingId`), s počtem osob (`people`) a vlastním stavem `pending` / `confirmed` / `rejected`.

## Role a přihlašování

Žádná hesla. Přihlášení přes **magic link** e-mailem (Resend): uživatel zadá e-mail, appka pošle 15minutový přihlašovací odkaz, po kliknutí appka nastaví 90denní session cookie ("zapamatuj toto zařízení"). Session je podepsané JWT (`jose`, `lib/auth.ts`), tajný klíč z env proměnné `AUTH_SECRET` (bez ní appka běží na nouzovém výchozím klíči — v produkci musí být nastavená).

- **Admin** (výchozí: Milan a Petr, seedováni automaticky při prvním běhu) — vidí frontu žádostí ke schválení, spravuje účty, může upravovat/mazat jakoukoli rezervaci, spravuje e-mailové šablony a slevové tiery.
- **Člen** — vidí stejný rozpis, může si rovnou zapsat vlastní rezervaci bez schvalování, v "Moje rezervace" ji může sám změnit/zrušit. Nevidí frontu žádostí ani správu účtů. Nové členy zakládá admin ručně.
- **Veřejnost** (bez účtu) — vidí jen agregovanou obsazenost (žádná jména/kontakty), může poslat žádost o pronájem/kurz nebo přihlášku na vypsaný termín kurzu, kterou schvaluje admin.
## Struktura kódu

```
app/
├── page.tsx                       # Veřejná stránka — obsazenost (týden/měsíc/kvartál/rok) + formulář žádosti
├── kurzy/page.tsx                  # Veřejná stránka kurzů — výběr tématu, přihláška na termín / poptávka pro skupinu
├── admin/page.tsx                   # Interní rozhraní (admin i členové) — kalendář, fronta žádostí, správa účtů,
│                                     #   e-mailové šablony, log e-mailů, slevové tiery
└── api/
    ├── bookings/route.ts             # GET (veřejnost = jen obsazenost, přihlášení = vše), POST (přihlášený rovnou vytvoří potvrzenou rezervaci)
    ├── bookings/[id]/route.ts        # PATCH/DELETE existující rezervace (admin/vlastník)
    ├── requests/route.ts              # POST — veřejná žádost o pronájem/kurz (vytvoří "pending" záznam, pošle e-maily)
    ├── requests/[id]/route.ts         # Schválení/zamítnutí žádosti adminem
    ├── courses/route.ts                # GET — veřejný seznam vypsaných budoucích termínů kurzů (s volnou kapacitou)
    ├── signups/route.ts                 # POST — veřejná přihláška na vypsaný termín; GET — admin seznam všech přihlášek
    ├── signups/[id]/route.ts             # Schválení/zamítnutí přihlášky adminem
    ├── discount-tiers/route.ts            # GET veřejné, POST/DELETE admin — slevové tiery pro skupiny
    ├── users/route.ts, users/[id]/route.ts # Správa účtů (admin)
    ├── auth/request-link, verify, me, logout/route.ts # Magic-link přihlášení
    └── admin/email-templates/*, admin/email-log/route.ts # Editace e-mailových šablon, log odeslaných e-mailů

lib/
├── types.ts          # Booking, CourseSignup, ResourceId, tabulka konfliktů CONFLICTS
├── db.ts               # Připojení k Neon (líné) + ensureSchema() — CREATE TABLE IF NOT EXISTS pro všechny tabulky
├── data.ts              # store nad tabulkou bookings (all/add/update/byDate/byUser/remove) + findConflict()
├── users.ts              # store nad tabulkou users
├── auth.ts                # Session JWT + magic-link tokeny
├── signups.ts              # store nad tabulkou course_signups + confirmedPeopleForBooking()
├── discounts.ts             # store nad tabulkou discount_tiers + výpočet skupinové slevy (viz níže)
├── email.ts                  # Odesílání e-mailů přes Resend (jednotlivé sendXxxEmail funkce)
├── emailTemplates.ts          # Výchozí texty šablon + editovatelné přepisy v DB, renderTemplate({{promenna}})
├── emailLog.ts                 # Log každého pokusu o odeslání e-mailu
└── calendar.ts                  # Sdílené pomocné funkce pro práci s daty (týden/měsíc/kvartál/rok)
```

## Databázové schéma (Neon Postgres)

Schéma se vytváří/rozšiřuje líně (`ensureSchema()` v `lib/db.ts`, voláno před každým přístupem k datům) přes `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ADD COLUMN IF NOT EXISTS` — žádný samostatný migrační krok.

- **`bookings`** — rezervace/termíny kurzů. Klíčové sloupce: `resource`, `date`, `start_time`, `end_time`, `title`, `status`, `source`, `user_id`, `category` (default `'pronajem'`), `capacity`, `price`.
- **`course_signups`** — přihlášky na termíny kurzů, `booking_id` → `bookings.id` (`ON DELETE CASCADE`), `people`, `status`.
- **`users`** — účty (`admin`/`member`), seedováni Milan + Petr při prvním běhu (`ON CONFLICT (email) DO NOTHING`, takže pozdější ruční úpravu v adminu nepřepíše).
- **`email_templates`** — přepisy výchozích textů e-mailových šablon (`key` PRIMARY KEY, `subject`, `body`).
- **`email_log`** — log každého pokusu o odeslání e-mailu (`type`, `recipient`, `subject`, `status: sent/failed/skipped`, `error`).
- **`discount_tiers`** — tiery skupinových slev (`min_fill_percent`, `discount_percent`, `sort_order`), seedováno výchozími 3 tiery při prvním běhu.

## Skupinové slevy (`lib/discounts.ts` + `discount_tiers`)

Sleva se počítá z **naplněnosti termínu** (počet přihlášených osob / kapacita termínu v %), ne z pevného počtu osob — funguje tedy pro libovolnou kapacitu kurzu.

- Tiery se řadí sestupně podle `minFillPercent`, vybere se první, do kterého se skutečná naplněnost vejde (`fillPercent >= tier.minFillPercent`).
- Výchozí tiery: 100 % naplněnosti → 30 % sleva, 83 % → 20 %, 67 % → 15 %.
- Vzorec celkové ceny: `pricePerPerson * people * (1 - discountPercent / 100)`, zaokrouhleno.
- Admin může tiery upravovat/přidávat/mazat v `/admin` (sekce "Slevy pro skupinové objednávky kurzu").
- Odhad slevy se zobrazuje rovnou u formuláře přihlášky na `/kurzy`, jakmile návštěvník zadá počet osob > 1.

## Kurzy: individuální vs. skupinové vstupy

Na `/kurzy` se vypsané termíny seskupují podle společného `title` do "témat" (žádná samostatná DB entita — čistě frontendové seskupení). U tématu je tlačítko **Koupit**, které nabídne:

- **Pro jednotlivce** → filtruje seznam vypsaných termínů na dané téma, návštěvník se přihlásí na konkrétní termín přes existující formulář (`POST /api/signups`).
- **Pro skupinu** → přesměruje na existující formulář poptávky vlastního termínu (`POST /api/requests`, `category: "kurz"`) — termín se individuálně domlouvá, neváže se na žádný konkrétní vypsaný den.

Žádný nový backend pro tuto funkci nebyl potřeba — obě cesty využívají mechanismy, které v appce už existovaly.

## E-maily (Resend, `lib/email.ts` + `lib/emailTemplates.ts`)

Odesílají se automaticky při: přihlašovacím odkazu (magic link), podání veřejné žádosti o pronájem/kurz (adminům i žadateli), podání přihlášky na vypsaný termín (adminům i přihlášenému), schválení/zamítnutí žádosti nebo přihlášky, úpravě/zrušení rezervace s zaškrtnutým "Informovat rezervistu".

14 editovatelných šablon (`TemplateKey` v `lib/emailTemplates.ts`), např. `admin_new_request_kurz`, `requester_decision_kurz_approved`, `admin_new_signup`, `signup_decision_rejected` atd. Admin je může upravit v `/admin` (sekce e-mailových šablon) — přepis se uloží do `email_templates`, pokud není upravený, používá se výchozí text z kódu. Proměnné v textu (`{{jmeno}}`) se při odeslání nahradí skutečnými hodnotami; systémové e-maily (magic-link, uvítací) editovatelné nejsou — jsou bezpečnostně citlivé.

Každý pokus o odeslání (úspěch i chyba) se loguje do `email_log`, přehled je v `/admin`.

## Proměnné prostředí (Vercel)

- `DATABASE_URL` / `POSTGRES_URL` — připojení k Neon Postgres.
- `AUTH_SECRET` — podepisování session a magic-link tokenů (**nutné nastavit na náhodný řetězec** v produkci).
- `RESEND_API_KEY` — odesílání e-mailů.
- `ADMIN_EMAILS` — nepovinné, čárkou oddělený seznam pro upozornění na nové žádosti/přihlášky.
- `NEXT_PUBLIC_APP_URL` — nepovinné, výchozí `https://rezervace.ateliernapobrezi.cz`.
- `WEBHOOK_URL` — nepovinné; pokud nastaveno, appka po každé změně rezervace notifikuje tuhle URL (viz sekce Webhook níže).
- `WEBHOOK_SECRET` — sdílený tajný klíč pro autentizaci webhooku; stejná hodnota musí být i v `data/webhook_secret.php` na `ateliernapobrezi.cz`.

## Webhook: notifikace o změně rezervací

Od 20. 8. 2026 appka po každém vytvoření/úpravě/smazání rezervace (`store.add`/`update`/`remove` v `lib/data.ts`) volá `notifyDataChanged()` z `lib/webhooks.ts` — POST na `WEBHOOK_URL` s hlavičkou `X-Webhook-Secret`. Zavedeno kvůli `kurzy.php` na hlavním webu (viz web-ateliernapobrezi.md), který si termíny kurzů cachuje na 5 minut — webhook umožňuje promítnout změnu okamžitě místo čekání na vypršení TTL.

Záměrně obecné a minimální:
- Payload nese jen typ události a pár identifikátorů (ne celá data rezervace) — příjemce si při triggeru vždy sám stáhne čerstvá data z veřejného `/api/courses`, takže webhook je jen spouštěč, ne zdroj pravdy.
- Volání je "fire-and-forget" s krátkým timeoutem (2 s) a vlastním try/catch — výpadek nebo pomalá odpověď příjemce nikdy nesmí zpomalit nebo shodit samotnou operaci s rezervací.
- Bez nastavené `WEBHOOK_URL`/`WEBHOOK_SECRET` se volání jen tiše přeskočí — appka funguje dál beze změny chování.
- Mechanismus není vázaný jen na kurzy.php — libovolný další příjemce (budoucí zobrazení dat jinde) se dá napojit stejným způsobem, jen si zaregistruje vlastní URL.

Příjemce na `ateliernapobrezi.cz`: `webhook-invalidate.php` (ověří `X-Webhook-Secret` proti `data/webhook_secret.php` přes `hash_equals`, pak zavolá `refresh_courses_cache()` z `inc/courses_cache.php` — vynucené živé stažení `/api/courses` a přepis `data/courses_cache.json`, bez ohledu na TTL). Podrobnosti k PHP straně viz web-ateliernapobrezi.md.


## Tech stack

Next.js 14.2.5 (App Router), React 18.3, TypeScript, Tailwind CSS, `@neondatabase/serverless`, `jose` (JWT), `resend`.

## Editační workflow (GitHub web editor)

V tomto prostředí není k dispozici přímý git/push nástroj — úpravy kódu se dělají přes webový CodeMirror editor GitHubu v prohlížeči:

1. Otevřít soubor na GitHubu, kliknout na tužku (Edit).
2. Malé cílené úpravy: kliknout do textu, upravit přesně danou část. Velké nové soubory: vypsat celý obsah najednou.
3. Před commitem vždy zkontrolovat diff v záložce **Preview** — potvrdit, že se změnila jen zamýšlená část.
4. Commitnout přímo do `main` s výstižnou zprávou.
5. Ověřit na `github.com/.../commits/main`, že commit má zelený "Verified" badge a "✓ 1/1" — kliknutím na fajfku se dá zobrazit "Vercel – Deployment has completed" jako důkaz, že build (TypeScript) prošel bez chyb.
6. Pro ověření chování naživo: `https://rezervace.ateliernapobrezi.cz`.

## Vztah ke `kurzy-vouchery-specifikace.md` (v repu)

V repu existuje starší návrhový dokument `kurzy-vouchery-specifikace.md` popisující plnohodnotný systém voucherů (`CourseOrder`, nákup kurzu bez výběru termínu, dárkové vouchery, platba, uplatnění kódu). **Byl realizován jen jeho slevový tier systém** (`discount_tiers`, viz výše) — samotný `CourseOrder`/voucherový backend postavený není. Výběr jednotlivec/skupina na `/kurzy` (viz sekce výše) totiž ukázal, že reálná potřeba se dala pokrýt bez něj, pomocí existujících `/api/signups` a `/api/requests`. Pokud v budoucnu přibude reálná potřeba prodeje kurzu jako dárku bez vázání na termín, je návrh v tomto souboru výchozí bod.

Spec dokument také počítal s tím, že i **`kurzy.php` na hlavním webu** by měl číst `GET /api/discount-tiers` a zobrazovat aktuální slevu v textu nabídky — to zatím implementované není (odhad slevy se zatím zobrazuje jen ve formuláři v rezervačním systému, ne na `kurzy.php`).

## Co zbývá doladit

- Samoobslužná registrace zájemců o členství (zatím se noví členové zakládají jen ručně adminem).
- Jiný styl e-mailů pro členy (tykání) oproti veřejnosti (vykání) — zatím všechny šablony vykají.
- Zobrazení aktuální skupinové slevy i v textu na `kurzy.php` (hlavní web), ne jen v rezervačním systému.

