# Novinky a změny

Průběžný log — nejnovější nahoře. Každý záznam: datum, co se změnilo, proč/kontext, kde (web / rezervace / obojí).

Historie do 13. 8. 2026 je zpětně sepsaná souhrnně (podle dokončených úkolů), jednotlivé dřívější kommity a přesné časy viz historie repozitáře na GitHubu.

---

## 2026-10-25 — Odkaz zpět na hlavní web v hlavičce rezervací (rezervace)

Logo v hlavičce teď vede na `https://ateliernapobrezi.cz` (dřív na úvodní rozpis rezervací), nad hlavičkou přibyl malý textový odkaz „← Zpět na web ateliéru“ (nový `components/BackToSite.tsx`, v administraci se neukazuje), protože ne každý ví, že logo je klikací (doporučení NN/g). Aby se z Kurzů dalo vrátit na rozpis, přibyl do menu v `HeaderNav.tsx` odkaz „Rezervace“ (mimo úvodní stránku). E-maily se tím neřeší.

---

## 2026-10-25 — Opravy překlepů a odkazů tlačítek na hlavním webu (web)

V `data/content.json` opraveno 10 textových klíčů: „tembulding“ → teambuilding, „činnosi“ → činnosti, „všednách“ → všedních, „něvenujete“ → nevěnujete (2×), „přítelky“ → přítelkyni, „v ateléru“ → v ateliéru a chybějící mezera, rozbitá věta „zpracovats tématem“ → „zpracovat“ (návrh, ke schválení Milanem), „pohodlném“ → pohodlné, „nednesete“ → neodnesete, dvojité tečky v patičce a kartě Firemní akce. Úvodní stránka: tlačítka měla odkazy jen podle pevných záloh v `index.php`, takže „Zjistit více o pronájmu“ vedlo na rezervace, „Kontaktovat nás“ na /pronajem a „Vybrat termín kurzu“ na /kontakt. Přidány klíče `hero_pronajem_btn_primary_target` (`pronajem`), `hero_pronajem_btn_secondary_target` (`kontakt`) a `banner_home_button_target` (`kurzy_vyber`) — jdou měnit v adminu. Postup: stažení `content.json`, přesné náhrady textu s kontrolou počtu výskytů a platnosti JSON, nahrání zpět (záloha původního souboru na Milanově počítači), ověření shody otisku na serveru a vykreslených stránek. Poučení: velký `content.json` neupravovat přepisem z paměti, ale stažením a přesnými náhradami.

---

## 2026-10-25 — DESIGN.md: design system a UX writing pravidla (web + rezervace)

Do kořene repa přidán `DESIGN.md` — jediný zdroj pravdy o vzhledu (tokeny: barvy, písma, zaoblení, mezery), komponentách a obsahových pravidlech (hlas, slovník, formáty, vzory microcopy) pro web i rezervační systém. Formát: YAML tokeny + text, inspirováno Google DESIGN.md (alpha) a DTCG; čtou ho lidé i AI agenti. Hodnoty převzaty z produkčního `styles.css` a ověřeny proti `tailwind.config.ts`, `layout.tsx` a `app/page.tsx` (stavy veřejného kalendáře). Součástí je seznam otevřených bodů z auditu (překlepy, kontrast textu v akcentní barvě, viditelný fokus ve formulářích, barvy kalendáře mimo značkovou paletu). Validátor `@google/design.md lint` zatím nespuštěn.

---

## 2026-10-24 — Sledování zdroje zájemců „Odkud o nás víte?“ (rezervace)

Přidáno pole „Odkud o nás víte?“ do rezervačního formuláře, přihlášky na kurz i formuláře pro dárkové poukazy — ukládá se jako nový sloupec `heard_about` v tabulkách `bookings`, `course_signups` a `vouchers`. Přibyl admin přehled statistik zdrojů (`/api/admin/referral-stats`) pro vyhodnocení, odkud lidé nejčastěji přicházejí. Vyvíjeno na větvi `odkud-o-nas-vite`, otevřen PR #8 (https://github.com/milansvolba/atelier-rezervace/pull/8).

## 2026-10-24 — Tučné písmo (Ctrl+B) v inline editaci textů (web)

Do inline editace textů na webu (`t-edit` pole) přidána podpora tučného písma přes Ctrl+B / Cmd+B — označený text se obalí do `**...**`, při uložení se převede na `<strong>`. Stejný princip jako dosavadní zápis odkazů `[text](url)`, bez nutnosti měnit `content.json`.

## 2026-10-24 — Darkové poukazy: oprava tlačítek, přehození sekcí, akordeon u kurzů (web)

Na stránce `darkove-poukazy.php` opravena špatně nastylovaná tlačítka „Koupit poukaz“ (chyběla základní třída `btn`, zůstala jen `btn-primary`). Sekce s nabídkou kurzů a cenou teď jde vidět hned po úvodních faktech, až pod ní návod na postup objednání (dřív to bylo obráceně). Karty kurzů v nabídce rozšířeny o rozklikávací akordeon s dalšími informacemi (náplň kurzu, co je v ceně, odkaz na detail kurzu), aby lidé nemuseli odcházet ze stránky pro víc informací.

## 2026-10-23 — Oprava inline editace a obrázek na darkove-poukazy.php (web)

Stránka `darkove-poukazy.php` měla všechny texty obalené navíc funkcí `e(t(...))` místo samotného `t(...)` — to u přihlášeného admina rozbíjelo inline editaci (span `t-edit` se zobrazoval jako escapovaný text místo fungujícího pole). Opraveno na stejný zápis jako na ostatních stránkách. Přidán nový editovatelný obrázek v hero sekci (`poukazy_hero_image`, přes `render_editable_image`) — stejný mechanismus nahrávání jako jinde na webu (`img-edit` + `/save-image`), pro vizuál/fotku dárkového poukazu. FAQ odpovědi na stránce teď taky nejsou dvakrát escapované (umožní v budoucnu vložit odkaz).

## 2026-10-23 — P2 bezpečnostní/přístupnostní balíček, nová 404 stránka, oprava darkove-poukazy.php (web)

Přidán `sitemap.xml` (12 URL) a odkaz na něj v `robots.txt`. Do `.htaccess` doplněny standardní HTTP security hlavičky (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy) a `ErrorDocument 404 /404`. Do `styles.css` přidán `.skip-link` styl a na všech 13 veřejných stránek přidán skip-link + `#main` kotva (přístupnost pro klávesnici). Nová stránka `404.php` ve stylu webu s mini-rozcestníkem (kurzy, pronájem, firemní akce, dárkové poukazy) a prolinkovaným textem na klíčová slova. Při té příležitosti opraven `darkove-poukazy.php`: chybělo `<?=` u `render_main_nav()`, `render_footer()` a `render_analytics_banner()`, takže se na stránce tiše nevykreslovala hlavička s logem, patička ani cookie lišta — teď fixed. Vše provedeno přes plugin forpsi-ftp a živě ověřeno.

## 2026-10-20 — Veřejný kalendář se třemi stavy (rezervace)
Bez přihlášení se v kalendáři a legendě ukazuje Volno, Rezervováno a Čeká na schválení. Příprava a úklid se zobrazují jako rezervováno; hláška při kolizi je obecná („Tento termín není k dispozici“). Důvody (úklid, příprava, firemní akce) vidí jen členové a admin. Odstraněn vysvětlující odstavec pod legendou.

## 2026-10-20 — Příprava a úklid v2: okna kolem akce podle role (rezervace)
Přepsáno `lib/prep.ts` podle příkladů Milana. Okna kolem akce na CELÝ ateliér (konstanty nahoře v souboru): akce od 12:00 dál = příprava téhož dne 8:00–14:00 a úklid následující den 8:00–12:00; dopolední akce (začíná před 12:00, končí do 13:00) = příprava den předtím 12:00–20:00 a úklid téhož dne od 12:00 do 20:00. Příklady: 26. 11. 2026 akce od 17:00 → 26. 11. 8–14 příprava, 27. 11. dopoledne úklid; 29. 10. 2026 školení 8–12 → 28. 10. odpoledne příprava, 29. 10. 12–20 úklid.
V oknech smí: admin vše (jen on je může přebít, i při schvalování žádosti), člen jen jednotlivé stoly a okno (ne celý ateliér, klubovnu ani pingpong), veřejnost nic. Platí i obráceně: novou akci na celý ateliér nelze vložit, pokud by její příprava nebo úklid zasáhly do cizí rezervace (admin může). Kontroluje se v `/api/requests`, `/api/bookings` a `/api/bookings/[id]` s rolí ze session.
Kalendáře: veřejný půlden dostane stav „příprava/úklid“ (šedá s pruhy). V admin kalendáři člen v týdenním přehledu vidí u zamčených míst „probíhá úklid“ nebo „příprava“ (admin jen jako informaci), v denním rozpisu je pruh s poznámkou. Předpoklady: úklid po večerní akci je následující den 8–12; okna se počítají po kalendářních dnech bez ohledu na víkendy a svátky.
Test: skript s 24 případy (oba příklady, role, nová akce, půldny) prošel; vizuálně netestováno (build lokálně nejde).

## 2026-10-20 — Příprava a úklid před akcí na celý ateliér + barvy veřejného kalendáře (rezervace)
Pravidlo (`lib/prep.ts`, `findPrepConflictFor` v `lib/data.ts`): rezervace celého ateliéru (kurz, firemní akce, pronájem) potřebuje volný půlden na přípravu. Akce od 12:00 dál blokuje dopoledne 8:00–12:00 téhož dne, akce začínající před 12:00 blokuje odpoledne 12:00–20:00 dne předtím. Platí oboustranně (nová akce nesmí zasáhnout do přípravy jiné ani naopak), kontroluje se při veřejné žádosti, vytvoření a úpravě rezervace i při schválení žádosti (409 s vysvětlením). Týká se jen resource „atelier“, členové si mohou rezervovat jednotlivá místa mimo čas samotné akce a po přihlášení vidí akci na celý ateliér s názvem.
Veřejný kalendář (`app/page.tsx`): stejné barvy jako admin (volno zelená, rezervováno šedá, čeká na schválení žlutá, příprava a úklid světlejší šedá s pruhy); každý den je rozdělený na dopoledne (levá půlka) a odpoledne (pravá půlka). Formulář žádosti předem varuje před obsazeným termínem i před kolizí s přípravou a odeslání v takovém případě zablokuje; chybu ze serveru ukáže doslovně. Modrá „na vyžádání“ zrušena.
Netestováno vizuálně (build lokálně nejde kvůli Google Fonts); logika pravidla ověřena skriptem (11 případů) a stavy půlek dne skriptem.

## 2026-10-20 — Počet odlitků místo „pro každého“ (rezervace)
Betonový odlitek už není ano/ne pro všechny: u jedné osoby je zaškrtávátko, u víc osob výběr 0 až počet osob (tlačítko „pro každého“). Platí na `/poukazy` i v objednávce kurzu na `/kurzy`. Server počítá cenu z počtu (`clampCastings`, `computeOrder(…, castings, …)`), do Stripe jde položka odlitku s tímto množstvím, metadata `casting` nese počet. Poukaz má nový sloupec `vouchers.casting_count` (starší poukazy s `casting = true` se berou jako odlitky pro všechny). Počet vidí admin v přehledu poukazů, v e-mailech a v poznámce přihlášky.

## 2026-10-19 — Dárkové poukazy na kurzy (rezervace) — na větvi `claude/vouchers-store`, zatím nenasazeno
Nákup: stránka `/poukazy` (kurz hlava/reliéf, 1–6 osob se stejnou skupinovou slevou jako u kurzů, volitelný odlitek, volitelný pevný termín, jméno/e-mail kupujícího, jméno obdarovaného, vzkaz; `?kurz=hlava|relief` předvybere kurz). Cena je vždy z ceníku poukazů (`VOUCHER_COURSES`), počítá ji server v `POST /api/vouchers/checkout`. Po zaplacení webhook (`meta.kind === "voucher"`, `lib/vouchers.ts` `handleVoucherPaid`) vytvoří poukaz (kód ATL-XXXX-XXXX, platnost 12 měsíců), pošle kupujícímu e-mail s kódem a adminům upozornění; idempotence přes unikátní index `vouchers_stripe_session_idx`. Poukaz s pevným termínem rovnou vytvoří potvrzenou přihlášku.
Uplatnění: na `/kurzy` v kroku 2 odkaz „Mám dárkový poukaz“ → kód → `POST /api/vouchers/redeem` (poukaz se atomicky označí jako uplatněný, vznikne potvrzená přihláška na celý počet osob poukazu, kontrola kapacity, kurzu a platnosti; e-mail obdarovanému i adminům). Poukaz s pevným termínem se znovu uplatnit nedá. Texty jsou v `lib/uiTexts.ts` (skupina „Dárkový poukaz“).
Admin: místo panelu Slevové stupně je přehled poukazů s tlačítkem „Označit jako uplatněný“ / „Vrátit mezi aktivní“ (`GET /api/vouchers`, `PATCH /api/vouchers/:id`). API `discount-tiers` zůstává, jen se nezobrazuje.
Netestováno end-to-end (Stripe sandbox + DB na preview nasazení); typecheck prochází. PDF poukaz zatím není.

## 2026-10-19 — Množstevní slevy podle počtu lidí + volitelný betonový odlitek (rezervace)
Nový `lib/pricing.ts`: sleva 2 os. 5 %, 3–4 os. 10 %, 5–6 os. 15 % (pevně v kódu; stará tabulka discount_tiers a její panel v adminu už se na cenu nepoužívají). Odlitek (hlava 3 900 Kč, reliéf 3 100 Kč za osobu, podle názvu kurzu) je checkbox v kroku 2 průvodce, počítá se pro všechny účastníky bez slevy a jde do Stripe Checkoutu jako druhá položka (`extraItems` v createCheckoutSession, stejná sazba DPH); částku počítá server. Informace o odlitku se zapíše do poznámky přihlášky.

## 2026-10-19 — Storno přihlášky na kurz + vratka přes Stripe (rezervace)
V detailu termínu kurzu (admin) je seznam potvrzených účastníků s tlačítkem „Stornovat“. Nabídne navrženou vratku podle pravidla (7+ dní do kurzu 100 %, 3–6 dní 50 %, 0–2 dny 0 %), částku lze upravit; vratka jde přes Stripe Refunds API (`POST /api/signups/:id/cancel`, GET dává náhled), přihláška dostane stav `cancelled` (místa se uvolní) a nepovinně odejde e-mail `sendSignupCancelledEmail` (zatím pevný text, ne šablona). Tabulka `payments` má nové sloupce payment_intent, amount_czk, signup_id, refunded_czk (naplňuje webhook; starší platby bez nich vratku přes appku nedostanou – vrátit ručně ve Stripe).

## 2026-10-19 — Logo zarovnané s levým okrajem obsahu; slevy v pravém sloupci adminu (rezervace)
Nový `components/AppShell.tsx` obaluje stránku a na `/admin` od lg rozšíří celý obal (hlavička i obsah) na `max-w-7xl`, takže logo i menu lícují s okraji obsahu; `<main>` v adminu už nepoužívá „breakout“. Na mobilu zůstává standardní úzký obal s okrajem px-4 (logo vlevo, stejný okraj jako obsah). Slevové stupně přesunuty do pravého sloupce, breakpoint dvou sloupců je lg, v detailu akce je přepínač „Firemní akce“.

## 2026-10-19 — Dvousloupcový admin, nové barvy kalendáře, obsazený termín nejde požádat (rezervace)
Admin rezervací (`app/admin/page.tsx`) je na široké obrazovce (xl, od 1280 px) ve dvou sloupcích: kalendář vlevo, vpravo žádosti ke schválení, přihlášky a Nejbližší akce; stránka se na xl roztáhne přes úzký kontejner (do 1280 px). Na menších obrazovkách a mobilu zůstává jeden sloupec. Barvy kalendáře: volno = jemně zelená, obsazeno/zablokováno jiným místem = šedá (nejde rezervovat), čeká na schválení = žlutá. `POST /api/requests` (veřejná žádost) odmítne obsazený termín hláškou „Tento termín je už obsazený“ (409, bez názvu akce). Veřejnosti (nepřihlášeným) API vrací jen obsazenost bez názvů a kontaktů (`publicSafe`).

## 2026-10-19 — Firemní akce skryté na veřejných Kurzech (rezervace)
Termín kurzu jde v adminu označit jako **firemní akci** (detail rezervace, Změnit, zaškrtávátko „Firemní akce (skrýt na veřejných Kurzech)“). Příznak je v tabulce `course_flags` (`lib/courseFlags.ts`, API `GET/PUT /api/bookings/:id/corporate`, jen admin). Taková akce se nevrací z `GET /api/courses` (tedy ani na veřejné stránce `/kurzy` a na webu) a `POST /api/signups` i `POST /api/signups/checkout` ji odmítnou (403). Kolize s ostatními rezervacemi se řeší jako dosud: termín na prostoru „celý ateliér“ blokuje ostatní místa při zápisu člena/admina i při schválení žádosti (`findConflict`); veřejná žádost o pronájem se v konfliktním čase může odeslat, ale nejde schválit.

## 2026-10-19 — Děkovací stránka po zaplacení členství (rezervace)
Po platbě se člen vrací na `/clenstvi?platba=ok` (poděkování, co dál, tlačítko do rezervací; funguje i bez přihlášení), po zrušení platby na `/clenstvi?platba=zrusena` (hláška, že se nic nestrhlo). Úvod před platbou i poděkování jsou v jednom souboru `app/clenstvi/page.tsx`. Platba i zrušení členství otestovány ve Stripe sandboxu.

## 2026-10-19 — Členství zdarma a datum konce zrušeného členství (rezervace)
Účet člena má přepínač „Zdarma“ (guestlist): sloupec `membership_free` v `users`; takový člen nedostane v uvítacím e-mailu odkaz na platbu, v Účtech je „člen zdarma“, odkaz „Členství“ se mu nezobrazuje (`/api/auth/me` vrací `membershipFree`) a `/api/membership/manage` ho přesměruje s hláškou. Přepínat jde při přidání účtu i později (`PATCH /api/users/:id`, jen admin). Webhook nově zpracovává `customer.subscription.updated` a ukládá `membership_ends_at` (zrušené předplatné doběhne ke konci zaplaceného období); v Účtech pak „členství zaplaceno, končí D. M. RRRR“. Účtování předplatného zůstává ke dni přihlášení člena (bez poměrných faktur). Role „Partner“ (mezistupeň mezi adminem a členem) odložena.

## 2026-10-19 — Zjednodušená rezervace pro členy, DPH ve Stripe (rezervace)
Člen (ne admin) ve formuláři „Nová rezervace“ nevyplňuje Kategorii ani Kdo/co: jméno se bere z účtu, kategorie je vždy pronájem. Pole Kontakt nahradilo zaškrtávátko „Chci potvrzení e-mailem“ (při zaškrtnutí se do kontaktu uloží e-mail z účtu; ten se používá pro upozornění na změnu/zrušení — samostatný potvrzovací e-mail při vytvoření zatím neexistuje). `POST /api/bookings` pro člena vynucuje jméno z účtu, kategorii pronájem a ignoruje cenu/kapacitu. Dále: sazba DPH ve Stripe přes env `STRIPE_TAX_RATE_ID` (členství i platby za kurzy), nová stránka `/clenstvi` (úvod před platbou členství; uvítací e-mail odkazuje sem).

## 2026-10-19 — Členství v klubu: platba předplatného přes Stripe (rezervace)
Člen dostane v uvítacím e-mailu odkaz na platbu měsíčního předplatného (Stripe Checkout, režim subscription; cena z env `STRIPE_MEMBERSHIP_PRICE_ID`). Odkaz `/api/membership/manage?token=…` platí 30 dní. Po přihlášení má člen nahoře odkaz „Členství“ (platba, nebo zákaznický portál Stripe: karta, faktury, zrušení). Webhook (`lib/membership.ts`) nastavuje stav členství (`none/active/past_due/canceled`, sloupce `membership_status`, `stripe_customer_id`, `stripe_subscription_id` v tabulce `users`) z událostí `checkout.session.completed` (subscription), `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`. Stav je vidět v adminu v panelu Účty. Faktury s číslem vystavuje Stripe.

## 2026-10-14 — Analytics MVP: GA4 + Search Console + Microsoft Clarity + cookie lišta (web + rezervace)

Na obou systémech (ateliernapobrezi.cz i rezervace.ateliernapobrezi.cz) zavedena základní návštěvnost/analytika: Google Analytics 4 (`G-3D28LW4JGC`), Search Console (ověřeno přes meta tag) a Microsoft Clarity (`yxhpksh1yt`), společně s GDPR cookie lištou (Přijmout/Odmítnout), která teprve po souhlasu načte GA4 a Clarity skripty (`cookie_consent` cookie, platnost 1 rok).

**Web (PHP):** lištu a podmíněné načítání skriptů řeší `render_analytics_banner()` v `inc/content.php`, vykreslené na všech stránkách.

**Rezervace (Next.js):** nová komponenta `components/AnalyticsConsent.tsx` (client komponenta, stejná logika/cookie/ID jako na webu, jen přepsaná do Reactu a stylovaná přes Tailwind brand paletu appky), vykreslená v `app/layout.tsx`. K tomu přidán jednoduchý GA4 event `vyber_terminu_kurzu` (kategorie `rezervace`, s názvem kurzu a datem) při kliknutí na konkrétní vypsaný termín na /kurzy — zatím jen tenhle jeden signál záměru, bez celého konverzního trychtýře (ten přijde, až se doladí prodejní/rezervační cesty).

Živě ověřeno na obou systémech (lišta se zobrazí/schová podle volby, cookie přežije reload, GA4+Clarity skripty se načtou až po Přijmout, dataLayer event ověřen v konzoli). Zbývá doporučit Milanovi nainstalovat do Chromu Google Analytics Opt-out Browser Add-on, ať mu vlastní návštěvy nezkreslují statistiky.

---

## 2026-10-14 — Průvodce objednávkou kurzu, živá cena, potvrzení v adminu (rezervace)

**/kurzy:** přihláška je teď průvodce ve 4 krocích (termín → počet míst 1–6 → kontakt → shrnutí a platba). Cena a skupinová sleva se přepočítají hned po výběru počtu míst a zůstávají vidět v hlavičce kroků (zákazník ví, kolik zaplatí, ještě než se dostane na Stripe); k tomu nabídka "přidejte ještě N míst a získáte slevu X %". Telefon je nepovinný (u pronájmu bude povinný). Všechny texty průvodce jsou ve `lib/uiTexts.ts` (klíč, popis, výchozí znění) — připraveno pro budoucí správu textů v adminu.

**/admin:** po uložení termínu, schválení/zamítnutí žádosti nebo přihlášky a uložení slevy se dole zobrazí krátká potvrzovací hláška (`toast()` v `app/admin/page.tsx`).

**Oprava:** první nasazení admin hlášek rozbilo build (hláška se při vkládání dostala mezi `async` a `function createBooking`); opraveno, build prošel. Poučení: při vkládání kódu přes marker `function X` hlídat předchozí klíčové slovo (`async`).

## 2026-10-14 — Online platba kurzu přes Stripe Checkout (rezervace)

Na `/kurzy` se kurz s cenou platí hned: tlačítko "Zaplatit a rezervovat" zavolá `POST /api/signups/checkout`, které spočítá cenu na serveru (cena × počet míst, skupinová sleva podle počtu míst v objednávce vůči kapacitě, max 6 míst online) a přesměruje na hostovanou platební stránku Stripe (karty, Apple Pay, Google Pay). Po zaplacení webhook `POST /api/stripe/webhook` (ověřený podpis) vytvoří rovnou **potvrzenou** přihlášku a pošle e-maily. Místa se po dobu platby drží v nové tabulce `payments` (35 min). Stripe voláme přes REST (`lib/stripe.ts`), bez npm balíčku. Nové env proměnné: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. Zatím jen sandbox; členství, pronájem a drobný prodej přijdou později.

## 2026-09-17 — 48 CMS polí v admin.php se nikdy neukládalo a zobrazovalo prázdno na živém webu (web)

**Co se stalo:** Milan hlásil, že cokoliv vyplní v CMS, se "nikde nepropíše" — a to napříč mnoha různými sekcemi, ne jen na jednom místě jako u předchozího bugu s Referencemi.

**Skutečná příčina:** Systémová kontrola ukázala, že `admin.php` obsahuje 98 formulářových polí (`name="c[...]"`), ale `content_defaults()` v `inc/content.php` i `data/content.json` měly jen 52 klíčů. Chybělo přesně 48 polí — všechny 4 tagy/tlačítka v hero slidech (`hero_kurzy_tag`, `hero_pronajem_tag`, 4× `hero_*_btn_*`), obě karty pod hero bannerem na homepage (`home_card1/2_*`), všech 5 CTA bannerů (`banner_home/kurzy/pronajem/lide/reference_*`), 4 boxy "Co vás čeká" na Kurzech (`kurzy_box1-4_*`), kroky a cílové skupiny na Pronájmu (`pronajem_step*`, `pronajem_aud1-4_*`, `pronajem_atmosfera`, `pronajem_vyuziti`). Protože žádný z těchto klíčů nebyl v `content_defaults()` ani v `content.json`, `save_content()` je při každém uložení odjakživa tiše zahazovala (viz `array_intersect_key` mechanismus popsaný v předchozím záznamu) — bez ohledu na opravu `save_content()` z dřívějška dnes, protože ta řeší jen ochranu už existujících klíčů, ne úplně chybějící. Navíc PHP šablony (`kurzy.php`, `pronajem.php`, `index.php` atd.) čtou tyhle klíče přímo bez fallbacku (`<?= e($c['banner_kurzy_title']) ?>`), takže se na živém webu reálně zobrazovalo prázdno — např. celý CTA banner na Kurzech byl viditelně prázdný (prázdný nadpis, text i tlačítko), stejně tak zbylé 4 bannery a mnoho dalších sekcí.

**Oprava:** Napsal jsem srovnávací skript (admin.php pole vs. content_defaults() vs. content.json) a doplnil všech 48 chybějících klíčů najednou do obou souborů s rozumným výchozím textem, aby weby přestaly zobrazovat prázdná místa. Ověřeno živě na všech dotčených stránkách (Domů, Kurzy, Pronájem, Lidé, Reference) — bannery, hero tagy/tlačítka, karty i boxy se teď zobrazují a půjde je přes admin.php i reálně upravit a uložit.

**Poučení do budoucna:** Kdykoliv se v `admin.php` objeví nové pole, zkontrolovat rovnou při zavedení všechny tři místa (viz skill), ne až když si toho Milan všimne o týdny později. Při podezření na plošný problém s CMS ukládáním vždy nejdřív spočítat a porovnat počty klíčů v `admin.php`/`content_defaults()`/`content.json` (pár řádků JS/regexu) místo ověřování pole po poli — je to řádově rychlejší a najde to najednou všechny postižené případy, ne jen ten nahlášený.

---

## 2026-09-17 — Sdílený náhled odkazu (og:image) ukazoval generický placeholder (web)

**Co se stalo:** Při sdílení odkazu na web (WhatsApp) se zobrazoval statický obrázek `images/og-image.jpg` nesouvisející s aktuálním obsahem webu — nikdo si nevšiml, že se od zavedení nikdy needitoval.

**Oprava:** `og:image` v `index.php` přesměrován přímo na existující `images/hero-kurzy.jpg` (fotka z hero slidu na homepage/Kurzech), s cache-busting verzí (`?v=<?= @filemtime(...) ?>`), stejně jako u `styles.css`. Text `og:title`/`og:description`/meta description zůstává beze změny (Milan to prošel, je to v pořádku) — jen si všimni, že meta description ještě zmiňuje "brzy i obchod s uměleckými potřebami", což už neplatí od skrytí Obchodu z menu — až bude na Obchod čas, zvážit i tenhle text.

---

## 2026-09-17 — Oprava ukládání mini CMS: nová pole se ztrácela, stará se resetovala na placeholdery (web)

**Co se stalo:** Milan zkoušel v adminu vyplnit nový "Hlavní nadpis" a "Úvodní text nad referencemi" na Reference, uložil, ale nic se nepropsalo — po uložení byly obě pole prázdná i na živém webu.

**Skutečná příčina (dvě různé chyby najednou):** `inc/content.php` má `content_defaults()` — pevný seznam "povolených" klíčů CMS obsahu — a `save_content()`, která při každém uložení dělá `array_merge($defaults, array_intersect_key($data, $defaults))`. To znamená: (1) `reference_heading` byl přidán do `content.json` a do formuláře v `admin.php`, ale nikdo ho nepřidal do `content_defaults()` — `array_intersect_key` ho proto při každém uložení potichu zahodil, takže se nedal uložit nikdy, bez ohledu na to, co Milan napsal. (2) Mnohem závažnější: `save_content()` stavěla nový obsah nad `$defaults` (pevně zakódované výchozí texty), ne nad aktuálním obsahem `content.json` — takže jakékoli pole, které zrovna nebylo součástí odeslaného POSTu (typicky kvůli staré/neobnovené záložce s admin.php, viz předchozí záznamy o tomhle problému), se při uložení tiše přepsalo zpátky na pevně zakódovaný placeholder text (např. "Termín bude upřesněn.") — ne že by se jen nezměnilo, ono se aktivně vrátilo na výchozí hodnotu z kódu.

**Oprava:** `reference_heading` doplněn do `content_defaults()`. `save_content()` přepsána tak, aby stavěla na `load_content()` (aktuální reálný obsah `content.json`), ne na `$defaults` — chybějící pole v POSTu teď zůstanou beze změny místo resetu na placeholder. Zároveň jsou jako "povolené" klíče uznávané i ty, co už reálně existují v `content.json`, i když je někdo zapomene zapsat do `content_defaults()` — samoopravné chování pro přesně tuhle situaci. Hodnoty `reference_heading` a `testimonials_intro` ručně obnoveny na správný text.

**Poučení do budoucna:** při přidání nového CMS pole je potřeba zapsat klíč na TŘECH místech, ne dvou: `content.json` (data), `admin.php` (formulářové pole) — a nově navíc `inc/content.php` → `content_defaults()` (whitelist). Vynechání třetího kroku field neuloží vůbec, tiše a bez chybové hlášky. Tahle oprava navíc snižuje (ale nemusí úplně vyloučit) riziko z dřívějších záznamů o přepisování obsahu starou/otevřenou záložkou admin.php.

---

## 2026-09-17 — Zarovnání H1 na Reference zpět do standardního sloupce (web)

Milan upozornil, že nadpis "Co říkají naši účastníci" po předchozí úpravě (viz záznam níže) vypadá "příliš vlevo". Příčina: hero `.container` na této stránce dostal `max-width:none`, takže na širokých obrazovkách začínal nadpis hned u okraje okna (24px), zatímco logo v hlavičce i karty referencí/banner pod ním zůstávaly ve standardním centrovaném 1120px sloupci — nadpis tak vizuálně nelícoval se zbytkem stránky. Řešení: `max-width:none` odstraněno, hero sekce Reference je zpátky ve stejném 1120px sloupci jako všechno ostatní na stránce i webu. Nadpis je krátký a stejně nedosahoval na okraje ani v "širokém" režimu, takže tímhle se nic vizuálně neztrácí — jen se získává konzistentní zarovnání s logem a obsahem níže.

---

## 2026-09-17 — Editovatelný text tlačítek na hero slidech homepage (web)

## 2026-09-17 — Editovatelný tag nad nadpisem na hero slidech homepage (web)

## 2026-09-17 — Cache-busting u styles.css (web) — oprava + poučení

## 2026-09-17 — Editovatelný hlavní nadpis na Reference, šířka na celou stránku (web)

Nadpis "Co říkají naši účastníci" nad referencemi byl natvrdo v `reference.php` a navíc uměle rozdělený na dva řádky tvrdým `<br>` uprostřed textu. Přidán nový klíč `reference_heading` do `content.json` (výchozí hodnota = původní text, ale jako jeden přirozený řádek bez `<br>`), `reference.php` ho čte přes `e($c['reference_heading'])`, a v `admin.php` přibylo pole "Hlavní nadpis" do fieldsetu "Reference" (nad "Úvodní text nad referencemi"). Zároveň byl z obalového `.container` v hero sekci této stránky odstraněný `max-width` (inline `style="...;max-width:none;"`), takže nadpis (a zbytek hero bloku) už není omezený na standardní 1120px sloupec sdílený se zbytkem webu, ale využívá celou dostupnou šířku stránky — důležité hlavně pro delší budoucí znění nadpisu přes CMS, které by se v úzkém sloupci mohlo zalamovat nevzhledně.

---

**Co se stalo:** po úpravě `.logo-img` v `styles.css` (viz záznam níže) hlásil Milan, že logo vypadá špatně i na velké obrazovce, přestože živý soubor na serveru byl už opravený a syntakticky v pořádku. Příčina: `styles.css` se ve všech stránkách linkuje jako `<link rel="stylesheet" href="styles.css">` bez verze/cache-busting parametru, a server pro něj neposílá `Cache-Control` ani `ETag` (jen `Last-Modified`) — prohlížeč tak po běžné navigaci (ne hard-refresh) klidně dál servíruje starou verzi z disk cache, i dlouho po uložení nové. Tohle není nový bug, je to vlastnost webu od začátku — dřív si toho nikdo nevšiml, protože změny CSS byly řídké nebo si je Milan neověřoval hned po uložení.

**Oprava:** do `<head>` všech 9 stránek, které `styles.css` používají (`index.php`, `kurzy.php`, `kurz-modelovani-hlavy.php`, `kurz-relief.php`, `pronajem.php`, `kontakt.php`, `lide.php`, `obchod.php`, `reference.php` — `admin.php` má vlastní inline styly, netýká se ho), přidán automatický cache-busting: `<link rel="stylesheet" href="styles.css?v=<?= @filemtime(__DIR__ . '/styles.css') ?>">`. Verze se generuje z modifikačního času souboru na serveru, takže se mění automaticky při každé budoucí úpravě `styles.css` bez nutnosti si na to pamatovat — a starý CSS by se tímhle způsobem už neměl nikomu "zaseknout" v cache.

**Poučení do budoucna:** po každé úpravě `styles.css` (nebo jiného staticky linkovaného souboru bez cache-busting verze) počítat s tím, že živé ověření přes vlastní fetch s `cache:'no-store'` nebo `?cb=` parametrem NEZARUČUJE, že totéž uvidí Milan ve svém běžném prohlížeči — jeho prohlížeč může mít starou verzi v cache, dokud neudělá hard refresh. Cache-busting v `<link>`/`<script>` tagu je systémová oprava tohohle problému pro `styles.css`; pokud se do budoucna přidá další staticky linkovaný soubor bez cache-busting verze (další CSS/JS), zvážit stejný vzor rovnou, ať se scénář neopakuje.

---

## 2026-09-17 — Zmenšení loga v hlavičce na mobilu (web)

Logo (`.logo-img`, wordmark s pevnou výškou 40px) na úzkých mobilních šířkách (320–400px) zabíralo cca polovinu šířky hlavičky a vizuálně přetěžovalo layout vedle hamburger menu — technicky nepřetékalo, ale působilo nevyváženě/příliš dominantně. V `styles.css` přidány dvě media query úpravy: `.logo-img { height: 30px; }` uvnitř existujícího `@media (max-width: 760px)` bloku (sdíleného s pravidly pro hamburger menu) a nová `@media (max-width: 380px) { .logo-img { height: 26px; } }` pro nejužší telefony. Ověřeno na živém webu při 320px, 375px a 1440px šířce — na velkých obrazovkách beze změny (40px), na mobilu logo teď proporčně menší a nechává hamburgeru víc prostoru.

---

Malý štítek/eyebrow nad H1 na obou slidech `.hero-slider` na Domů ("Odpočinkové výtvarné kurzy", "Pronájem prostoru") byl natvrdo v `index.php` (`<span class="slide-tag">...</span>`). Přidány 2 nové klíče do `content.json` (`hero_kurzy_tag`, `hero_pronajem_tag`, výchozí hodnoty = původní texty, vizuálně beze změny), `index.php` je čte přes `e($c[...])`, a v `admin.php` přibylo pole "Tag nad nadpisem" do obou fieldsetů "Homepage — slide Kurzy/Pronájem".

---

Oba slidy v `.hero-slider` na Domů (Kurzy, Pronájem) měly text obou tlačítek ("Vybrat termín kurzu"/"Poptat termín" a "Více informací") natvrdo v `index.php`. Přidány 4 nové klíče do `content.json` (`hero_kurzy_btn_primary`, `hero_kurzy_btn_secondary`, `hero_pronajem_btn_primary`, `hero_pronajem_btn_secondary`, výchozí hodnoty = původní texty, vizuálně beze změny), `index.php` je čte přes `e($c[...])`, a v `admin.php` přibyla pole "Text tlačítka (rezervace)" a "Text tlačítka (odkaz)" do obou fieldsetů "Homepage — slide Kurzy/Pronájem".

---

## 2026-09-17 — Auto-mazání starých rezervací + kompaktní "Nejbližší akce" v adminu (rezervace)

Adminův přehled by časem narůstal do nekonečné délky. Řešení ve dvou krocích:

1. **Data:** appka teď drží jen aktuální a předchozí kalendářní měsíc — `lib/data.ts` má lazy `pruneOldBookings()` (bez cronu, kontrola nejvýš jednou za 6 hodin při `store.all()`), který maže `bookings` starší než začátek předminulého měsíce. `course_signups` mají `ON DELETE CASCADE` na `booking_id`, smažou se automaticky spolu s rezervací.
2. **UI:** sekce "Moje rezervace" (neomezený seznam všech budoucích rezervací) nahrazena kompaktním blokem "Nejbližší akce" — zobrazí jen první 3 položky, zbytek shrne řádkem "+ N dalších — najdeš je v kalendáři výše" (kalendář/denní rozpis nad tím stejně vše obsahuje).

---

## 2026-09-17 — Přejmenování zdroje "Stůl 1" na "Stůl s monitorem" (rezervace)

Milan chystá plánek prostoru pro lepší orientaci — do té doby přejmenován popisek zdroje `stul1` (interní ID beze změny) z "Stůl 1" na "Stůl s monitorem": `RESOURCE_LABELS` v `lib/types.ts`, `RESOURCE_OPTIONS` v `app/admin/page.tsx` a zmínka v `README.md`.

---

## 2026-09-17 — Overlay gradient hero slideru: modrá → šedá (web)

Overlay přes fotky v `.hero-slider` (homepage) používal tmavě modrý (námořnický) gradient `rgba(15, 21, 38, ...)` shodný s `--color-navy`. Na žádost Milana změněno na neutrální šedou `rgba(26, 26, 26, ...)` se stejnou průhledností a rozložením (82 % / 58 % / 28 %) — text zůstává stejně čitelný, jen bez modrého nádechu.

---

## 2026-09-17 — Zmenšení hero bannerů (web)

Na žádost Milana zmenšeny hero bannery zhruba o 20 %: homepage `.hero-slider` `min-height` 640px → 512px (styles.css), Kurzy vnitřní `<section class="hero">` padding 90px/30px → 72px/24px (inline styl v kurzy.php). Pronájem hero banner nemá (jen běžný `.hero` header), takže se ho úprava netýká.

---

## 2026-09-15 — Feed pro Google/Apple kalendář (rezervace)

Nová veřejná (ale netušitelná) route `GET /api/calendar.ics` vrací všechny potvrzené rezervace jako iCalendar feed — v mobilu jde přidat přes Google Kalendář → Nastavení → "Z URL" (`https://rezervace.ateliernapobrezi.cz/api/calendar.ics?token=...`). Přístup hlídá sdílený token v query stringu (env `CALENDAR_FEED_TOKEN`, nastavuje se ve Vercelu), přihlášení kalendářové appky neumí. Časy se posílají s `TZID=Europe/Prague` (napevno zabudovaná pravidla CET/CEST, ať feed nezávisí na časovém pásmu serverless runtime). Google/Apple si feed obnovují po svém (řádově hodiny) — nejde to z naší strany urychlit ani "pushnout", to je limitace odběru kalendáře přes URL, ne naší appky.

---

## 2026-09-15 — Veřejná stránka: navigace v kalendáři + upozornění na kolizní termín; admin: slevy přesunuty dolů (rezervace)

Na veřejné stránce šlo listovat jen "dnešek a dál" bez možnosti přepnout na jiný týden/měsíc/kvartál/rok — teď je tam stejná navigace (‹ › a "Dnes") jako v adminu. Formulář žádosti navíc upozorní (bez blokace odeslání), pokud zvolený termín koliduje s už potvrzenou rezervací — text v duchu "prostor už má zamluvený někdo jiný, ale zkusíme to nějak vymyslet, případně najdeme jiný termín". V adminu se sekce "Slevy pro skupinové objednávky kurzu" přesunula z horní části stránky až na úplný konec (za všechny pohledy kalendáře) — kalendář a přehled jsou to, co admin potřebuje vidět nejdřív a nejčastěji, nastavení slev je spíš occasional setup.

---

## 2026-08-20 — Kurzy: rozcestník + detailní stránky pro jednotlivé kurzy (web)

`kurzy.php` je teď rozcestník (hero, karty kurzů, „Co vás čeká", průvodce, FAQ) — termíny a reference u jednotlivých kurzů se přesunuly na dvě nové stránky `kurz-modelovani-hlavy.php` a `kurz-relief.php`. Každá detailní stránka má vlastní úvodní text (`course1_detail_intro`/`course2_detail_intro` v `content.json`, fallback na starý `course{n}_desc`), fotky přes `img_src()` s placeholderem (Milan doplní FTP uploadem souborů `images/course1_1.jpg`, `course1_2.jpg`, `course2_1.jpg`, `course2_2.jpg` — bez nutnosti další úpravy kódu), termíny z `get_cached_courses()` a reference z `build_testimonials()`, obojí filtrované klíčovým slovem podle kurzu (název termínu/tag reference obsahuje „hlav" resp. „reliéf"/"relief"), a vlastní přesný `Course` schema.org blok. Karty na `kurzy.php` teď místo externího odkazu na rezervaci vedou na tyhle detailní stránky („Zobrazit detail a termíny"). Starý nepřesný jednotný schema.org blok (jen pro kurz 1, se všemi referencemi) byl z `kurzy.php` odstraněn. Oprava dokumentace: dřívější popis flow „Koupit → Pro jednotlivce/Pro skupinu" (modal) v `web-ateliernapobrezi.md` neodpovídal realitě — živý kód měl vždy jen prostý odkaz „Vybrat termín" na rezervaci; opraveno tamtéž.

---

## 2026-08-20 — Webhook: okamžitá invalidace cache kurzů při změně rezervace (obojí)

Při vytvoření, úpravě nebo smazání rezervace/termínu kurzu appka rezervace nově pošle webhook na web (`notifyDataChanged()` v `lib/webhooks.ts`, volané ze `store.add`/`store.update`/`store.remove` v `lib/data.ts`). Web přijme POST na `/webhook-invalidate` (ověření sdíleného tajemství v hlavičce `X-Webhook-Secret` přes `hash_equals`) a rovnou přepočítá souborovou cache termínů kurzů (`refresh_courses_cache()` v novém `inc/courses_cache.php`, sdíleném s `kurzy.php`). Dřív se cache obnovovala až po vypršení 5min TTL, teď se projeví změna na Kurzy prakticky okamžitě. Webhook je navržený obecně (typ události + id, příjemce si vždy dotáhne čerstvá data sám) — do budoucna půjde použít i pro jiná místa webu, ne jen tuhle cache. Selhání webhooku (výpadek, timeout 2 s) nijak neovlivní uložení rezervace, jen se nestihne okamžitá invalidace a čeká se na TTL. Detaily viz `dokumentace/rezervace-system.md` (sekce Webhook) a `dokumentace/web-ateliernapobrezi.md` (PHP strana).

---

## 2026-08-20 — Výběr termínu při kliku na buňku s víc rezervacemi (rezervace)

Milan hlásil, že v adminu vidí booknuté termíny, které nejde odstranit. Příčina: v týdenním i denním/měsíčním pohledu kalendáře klik na buňku (místo + den) otevřel detail s tlačítkem Smazat jen když v ní byl přesně jeden potvrzený termín — pokud jich tam bylo víc najednou (zobrazené spojené v textu buňky), klik místo detailu spustil formulář na založení nové rezervace, takže se k mazání/úpravě žádného z nich nedalo dostat. Přidána nová komponenta `BookingPickerModal` — když má buňka víc potvrzených termínů, klik teď nabídne jejich seznam k výběru, a teprve po výběru konkrétního termínu se otevře existující detail se Smazat/Změnit. Ověřeno přes TypeScript build na Vercelu (commit e309156, deployment completed).

---

## 2026-08-20 — Cache pro živé termíny na Kurzy (web)

Stránka /kurzy byla pomalá, protože při každém načtení synchronně čekala na živé volání /api/courses na Vercelu (i s timeoutem 4 s). Přidána souborová cache v kurzy.php (`data/courses_cache.json`, TTL 5 minut): pokud je cache čerstvá, termíny se načtou z ní okamžitě; jinak proběhne živé volání s krátkým timeoutem a cache se přepíše; při selhání živého volání (výpadek/timeout) se použije poslední známá cache místo prázdné stránky. Timeout 2 s se ukázal jako příliš krátký — živé volání běžně nestihlo doběhnout, cache se nikdy nenaplnila — po ověření naživo nastaveno na 3 s.

---

## 2026-08-19 — Fotky u referencí (kruhový ořez) + zvýraznění jmen (web)

Milan chtěl u jednotlivých referencí fotku účastníka, ideálně kruhový ořez, a mírně zvýraznit jména. Řešení:

- Do inc/content.php přidány sdílené funkce `build_testimonials($c)` a `render_testimonial_card($t)` — dřív měly kurzy.php a reference.php každá svou vlastní kopii stejné logiky (stejný problém jako u bia lektora, viz záznam z 17. 8.), teď je to na jednom místě, aby se to znovu nerozjelo.
- Karta reference: fotka (pokud je nahraná) se zobrazí jako kruh 44×44 px vedle jména (`border-radius:50%; object-fit:cover`) — stejný princip jako u foto slotů jinde na webu, žádný přesný ořez při nahrávání není potřeba.
- Jméno zvýrazněno silněji (font-weight 600 místo 500).
- V admin.php přibyly 4 nové foto sloty (Reference 1–4 – fotka) v sekci Fotky — dokud fotka není nahraná, karta funguje beze změny (fotka se prostě nezobrazí).
- Ověřeno naživo na /kurzy i /reference, žádné PHP chyby.

## 2026-08-17 — Doplnění profilu lektora + oprava duplicity bia mezi Kurzy a Lidé (web)

Na základě CV Petra Švolby doplněn odstavec do jeho bia (pole person_petr_bio v CMS): lektorská zkušenost v Lektorském centru GASK v Kutné Hoře, mezinárodní výstavy (Londýn, Brusel, Curych), rezidence v Egon Schiele Art Centru v Českém Krumlově a sympozium Šumakárt (zmíněno i kvůli plánovaným kurzům v přírodě). Při té příležitosti se zjistilo, že stránka kurzy.php měla bio lektora natvrdo napsané v kódu (starší, kratší verze textu) místo napojení na CMS pole — takže úprava přes admin.php se na Kurzech vůbec neprojevila. Opraveno: kurzy.php teď stejně jako lide.php vypisuje person_petr_bio dynamicky (rozdělené na odstavce), takže napříště stačí upravit text na jednom místě a projeví se všude.

## 2026-08-17 — Oprava rozbaleného menu na mobilu (web)

Milan nahlásil, že se na mobilu po rozkliknutí hamburger menu zobrazí jen úzký ořezaný pruh vpravo nahoře místo menu přes celou šířku. Příčina: obal .nav-wrap měl position: relative, ale na mobilu se zmenší jen na šířku tlačítka hamburgeru (protože samotné menu je při zavření vyjmuté z toku přes position: absolute a nepřispívá k jeho šířce) — rozbalené menu (.nav-links, taky position: absolute; left:0; right:0) se pak zarovnalo jen do téhle úzké krabičky u ikony místo celé hlavičky. Oprava: odstraněno position: relative z .nav-wrap — menu se teď zarovná podle nejbližšího pozicovaného předka, kterým je header.site-header (position: sticky, přes celou šířku), takže se rozbalí správně přes celou šířku obrazovky.

## 2026-08-14 — Rozcestník: sticky boční panel v levém okraji stránky (web)

Milan sám navrhl kompromis: pokud by rozcestník byl dost nízký, mohl by být sticky znovu — třeba v levém sloupci. Stránka admin.php má fixní šířku obsahu 760 px a je vystředěná, takže na širších obrazovkách (od ~1200 px) je po stranách volné místo. Do něj teď (přes `position: fixed`) sedí úzký postranní panel s odkazy na všech 7 sekcí (6 stránek + Fotky) — nezabírá žádné místo v hlavním sloupci a nekonkuruje formulářovým polím. Aktuální sekce se v panelu zvýrazňuje podle scrollu (IntersectionObserver). Na užších obrazovkách (pod 1200 px) se panel automaticky skryje a zůstává původní horizontální rozcestník nahoře stránky, aby nic nepřekrývalo obsah. Ověřeno naživo (Milan přihlášený) — panel drží na místě při scrollu, zvýraznění funguje, formulář zůstává celý viditelný.

## 2026-08-14 — Rozcestník: horizontální dlaždice místo svislého seznamu, bez sticky (web)

Milan na živém náhledu upozornil na dvě věci: rozcestník byl moc vysoký (svislý seznam 7 položek), a i po zkrácení by permanentně přilepený (sticky) nahoře zabíral místo, které chce vidět při editaci obsahu níž na stránce. Řešení:

- Rozcestník přeskládán do řádků vedle sebe (flex, 3 sloupce), pod každou stránkou jen krátký popisek — výška klesla z ~430 px na ~230 px.
- Odstraněna sticky pozice — rozcestník je teď normální součástí toku stránky, po scrollu zmizí a neblokuje výhled na editovaná pole.
- Odstraněn i doprovodný scrollspy skript (zvýrazňování aktuální sekce), protože bez sticky nemá smysl.

## 2026-08-14 — Rozcestník v mini CMS podle stránek + odkazy na fotky (web)

Milan chtěl po přihlášení do admin.php rovnou vidět, co lze upravit na jednotlivých stránkách — včetně fotek, ne jen texty. Rozcestník přepracován z jednoduchého seznamu odkazů na strukturovaný výpis podle stránek (Domů, Kurzy, Pronájem, Lidé, Reference, Kontakt): u každé stránky je teď stručný popis, co pod ní jde upravit, a odkaz rovnou na sekci Fotky s počtem fotek, které se k dané stránce vážou. Sekce Fotky dostala vlastní ukotvení (#sec-fotky). Ověřeno naživo, Milan byl v té chvíli přihlášený, takže i vizuálně potvrzeno.

## 2026-08-13 — Rozšíření mini CMS: rozcestník, bannery, boxy a výčty (web)

Na přání Milana rozšířeno, co jde upravovat v admin.php bez zásahu do kódu:

- Přidán rozcestník (rychlá navigace) nahoře ve formuláři, odkazy skáčou na Domů / Kurzy / Pronájem / Lidé / Reference / Kontakt.
- Editovatelné bannery (nadpis, text, tlačítko) na konci stránek Domů, Kurzy, Pronájem, Lidé, Reference — dřív pevně v kódu.
- Editovatelné karty na Domů (2×) a boxy na Kurzy (4×).
- Editovatelné kroky (2 a 3, krok 1 má editovatelný jen nadpis — text obsahuje odkazy na rezervační kalendář a kontakt, zůstává v kódu), cílové skupiny (4×) a položky Atmosféra/Využití na Pronájem. Položka Poloha zůstala napojená na Kontakt e-mail/adresu (contact_address), aby se nezdvojovala.
- V content.json přibylo 44 nových polí, všechny doplněny s výchozím textem shodným s tím, co dřív bylo natvrdo v kódu — žádná změna viditelná na webu, dokud je Milan v CMS neupraví.
- Ověřeno naživo na všech stránkách, žádné chyby.

## 2026-08-13 — Štítky v hero banneru: bílé pozadí, černý text (web)

Milan chtěl místo tmavě zlaté varianty (viz níže, oprava kontrastu) rovnou bílé pozadí s černým textem pro .slide-tag. Upraveno ve styles.css.

## 2026-08-13 — Oprava kontrastu badge na homepage hero (web)

Milan nahlásil špatný kontrast textu v pill badge "Odpočinkové výtvarné kurzy" (přes fotku v hero slideru). Změřeno 1.67:1 (WCAG AA vyžaduje 4.5:1 pro běžný text). Přidána proměnná --color-accent-dark (#6c5319, tmavší zlatá) a použita jako barva textu v .slide-tag místo --color-accent. Nový kontrast 5.33:1. Ostatní barevné prvky (tlačítka, placeholder) prošly kontrolou a jsou v pořádku.

## 2026-08-13 — Font nadpisů: Fraunces → Work Sans (web)

Změněna proměnná --font-display ve styles.css z ozdobného serifu Fraunces na Work Sans (stejný font, co už web používá pro běžný text) — týká se h1–h4 i loga v hlavičce. Jednodušší, čitelnější, stále v souladu se zbytkem webu. Otestováno naživo (pozn.: web nemá cache-control hlavičky na statické soubory, po změně CSS je potřeba tvrdý refresh Cmd/Ctrl+Shift+R, jinak prohlížeč chvíli ukazuje starou verzi).

## 2026-08-13 — Tlačítko Uložit u každého bloku v mini CMS (web)

V admin.php přidáno tlačítko Uložit za každý obsahový blok (Homepage slidy, Kurz 1, Kurz 2, Nejbližší termíny, Pronájem, Kontakt, Lidé) — dřív bylo jen jedno na konci celé stránky. Formulář je pořád jeden celek, takže každé tlačítko uloží všechny sekce najednou, jen je teď po ruce hned u bloku, který se upravuje.

## 2026-08-13 — Obnova zapomenutého hesla do admin.php (web)

Přidána cesta pro případ zapomenutého hesla: nahrání prázdného souboru `data/RESET_PASSWORD` přes FTP zobrazí na `admin.php` místo přihlášení formulář na nastavení nového hesla (bez znalosti starého). Po nastavení se soubor sám smaže. Otestováno naživo (formulář se zobrazil, marker soubor smazán bez uložení nového hesla).

## 2026-08-13 — Draft copy o skupinové slevě na stránce Kurzy (rezervace)

Přidána krátká věta u "Kurz na míru pro skupinu" zmiňující, že skupiny mají výhodnější cenu — zatím jen draft formulace, označeno komentářem v kódu pro finální doladění copy (Milan). Reakce na zjištění, že skupinová sleva (viz výše) nebyla nikde v textu webu zmíněná.

## 2026-08-13 — Výběr typu kurzu: jednotlivec / skupina (web + rezervace)

Na `/kurzy` se termíny kurzů nově seskupují do "témat" podle názvu. Tlačítko "Koupit" nabídne volbu Jednotlivec (filtruje na vypsané termíny, existující přihlašovací formulář) / Skupina (existující formulář poptávky vlastního termínu). Bez nového backendu — využívá existující `/api/signups` a `/api/requests`.

## 2026-08-13 — Skupinové slevy pro kurzy (rezervace)

Nová tabulka `discount_tiers`, API `/api/discount-tiers`, admin rozhraní pro správu tierů, live odhad slevy na formuláři přihlášky. Sleva se počítá z naplněnosti termínu (%), výchozí tiery 100 %→30 %, 83 %→20 %, 67 %→15 %.

## 2026-08-12/13 — Sladění vizuálu rezervačního systému s webem (rezervace)

Vizuální ladění appky podle stylu hlavního webu, opravena zapomenutá stará značka "Kurzy Vysochej" → "Kurzy".

## do 2026-08-12 — Editace e-mailových šablon + log odeslaných e-mailů (rezervace)

14 editovatelných šablon v adminu, ukládání přepisů do `email_templates`, log každého pokusu o odeslání do `email_log`.

## do 2026-08-12 — Oprava rate-limiting chyby v admin.php (web)

Opravena chyba v evidenci neúspěšných přihlašovacích pokusů (`data/admin_login_attempts.php`).

## do 2026-08-12 — Stránka Lidé (web)

Nová stránka `lide.php` + vlastní CMS pole v `content.json`.

## do 2026-08-12 — Clean URLs (web)

Odstraněny `.php` přípony z adres přes `.htaccess`.

## do 2026-08-12 — Úpravy menu (web)

Obchod skrytý z hlavního i patičkového menu (čeká na pseudogalerii). Odebráno "Rezervovat" z hlavičky, silnější CTA na stránce Pronájem.

## do 2026-08-12 — Stránka Reference (web + rezervace)

Scaffold stránky Reference + pruh referencí u Kurzů.

## do 2026-08-12 — Propojení kurzy.php s rezervačním systémem (web + rezervace)

`kurzy.php` živě natahuje vypsané termíny z `/api/courses`.

## do 2026-08-12 — Obohacení stránky Pronájem prostoru (web)

---

*Nové záznamy přidávej nahoru, ve stejném formátu (datum — stručný popis, systém). Podrobnosti architektury patří do `web-ateliernapobrezi.md` / `rezervace-system.md`, sem jen stručný log.*
