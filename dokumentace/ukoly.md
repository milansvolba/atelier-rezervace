# Seznam úkolů a stav
## ▶ PRIORITY A STAV (aktualizováno 2026-10-20)

**Pravidlo řazení:** úkol, který **omezuje spuštění** (ostrý provoz, příjem plateb od zákazníků, bezpečnost, právní nutnost), má **P0**. Zbytek se řadí podle poměru (přínos + dopad na prodej + bezpečnost) k pracnosti. Hodnocení je návrh Claude a Milan ho potvrzuje nebo mění.
Škály: **Přínos** a **Dopad na prodej** 1–5 (5 = nejvyšší), **Bezpečnost/právo** 0–3 (3 = kritické), **Pracnost** S (do 1 h) / M (půl dne) / L (víc dní) / ext (čeká na někoho mimo nás).

**Cíl:** členství spustit co nejdřív v **ostrém Stripe**; ostré spuštění ostatních plateb (kurzy, poukazy) v listopadu.

### P0 — blokuje spuštění
| # | Úkol | Blokuje | Bezp. | Přínos | Dopad na prodej | Pracnost | Kdo |
|---|---|---|---|---|---|---|---|
| 1 | **Ostrý Stripe pro členství:** aktivace účtu (ověření totožnosti), ve Vercelu ostré `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_MEMBERSHIP_PRICE_ID` (cena 249 Kč měs. už je v ostrém Stripe), `STRIPE_TAX_RATE_ID` (ostrá sazba 21 % vč. DPH), ostrý webhook (6 událostí: `checkout.session.completed`, `checkout.session.expired`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`), ostrý zákaznický portál (zrušení ke konci období, faktury), údaje o firmě a číslování faktur; poté Redeploy | členství, vše ostré | 3 | 5 | 5 | M | Milan (klíče jen do Vercelu, nikdy do chatu) + Claude (kontrola) |
| 2 | **Zkušební ostrá platba:** člen za 249 Kč vlastní kartou, kontrola faktury (číslo, DPH 21 %, IČO/DIČ), stavu v Účtech, zrušení přes portál, vratka; ověřit Apple Pay/Google Pay v ostrém režimu | členství | 2 | 4 | 4 | S | Milan + Claude |
| 3 | **Obchodní a členské podmínky + souhlas před platbou + zásady ochrany osobních údajů** (právník; odkazy doplnit i do portálu Stripe a e-mailů). Doplnit i právní otázku odstoupení do 14 dnů (Milanův právní agent) | všechny platby spotřebitelů | 3 | 4 | 4 | ext (právník) + M (zapojení) | Milan + právník; Claude připraví podklad a zapojení do formulářů |
| 4 | **DPH s účetní:** členství 21 %, kurzy, odlitky, poukazy (jednoúčelová × víceúčelová), faktury Stripe vs. Caflou | kurzy, poukazy | 3 | 3 | 4 | ext | Milan |
| 5 | **Ověřit firemní akce:** příznak „firemní akce“ je v kódu hotový; zkontrolovat v adminu, že oba termíny (Předvánoční coworkshop 26. 11., Comp-any 3. 12.) mají příznak a nejsou na veřejném `/kurzy` | kurzy | 2 | 3 | 3 | S | Milan |
| 6 | **End-to-end test poukazů a odlitků** v sandboxu: nákup bez termínu i s termínem, uplatnění kódu na `/kurzy`, plný termín, propadlý/uplatněný kód, 2 osoby + 1 odlitek = 19 613 Kč u hlavy, e-maily, admin přehled | poukazy, kurzy | 2 | 4 | 5 | S | Milan (proklikání) + Claude (kontrola ve Stripe přes konektor) |

### P1 — silná doporučení před ostrým provozem
| # | Úkol | Bezp. | Přínos | Dopad na prodej | Pracnost | Poznámka |
|---|---|---|---|---|---|---|
| 7 | **Aktualizace Next.js 14.2.5** na záplatovanou verzi 14.2.x | 2 | 3 | 1 | M | Aplikace nemá `middleware.ts`, takže se jí nejznámější zranitelnost obejití middleware pravděpodobně netýká; ostatní zranitelnosti jsem neověřoval. Dělat na větvi s kontrolou Vercel preview |
| 8 | **Zálohy databáze (Neon) a upozornění na selhání webhooku/e-mailů** (kde se dozvíš, že se platba nezapsala) | 2 | 4 | 3 | S–M | Ověřit plán Neonu a retenci; webhook už loguje chyby, chybí upozornění |
| 9 | **Marketingová stránka poukazů na PHP webu** s odkazem `/poukazy` (`?kurz=hlava` nebo `?kurz=relief`) | 0 | 4 | 5 | M | Dělá Milan; startuje po testu č. 6 |
| 10 | **PDF poukaz a vizuál** (dárek před Vánoci) | 0 | 4 | 4 | M | Termín: před vánoční sezónou |

### P2 — hodnota po spuštění, řazeno podle poměru přínos/pracnost
| # | Úkol | Přínos | Dopad na prodej | Pracnost | Poznámka |
|---|---|---|---|---|---|
| 11 | **Potvrzovací e-mail při rezervaci člena** (dnes jen změna/zrušení) | 3 | 2 | S | Navazuje na spuštění členství |
| 12 | **Správa textů v adminu** nad `lib/uiTexts.ts` (seznam, popis „kde se zobrazuje“, náhled, vrátit výchozí, tabulka `ui_texts`) | 4 | 2 | M | Milan je UX writer a chce ladit tón |
| 13 | **Pronájem s platbou** (poptávka, dočasná blokace 2 pracovní dny od schválení, e-mail s platbou, finální blokace; telefon povinný) | 5 | 5 | L | Potřebuje ceny a varianty od Milana; produkty ve Stripe se založí až s touto stavbou |
| 14 | **Audit zpětné vazby (toasty):** správa členů, e-mailové šablony, úprava/smazání rezervace, rychlé přidání, veřejná `/` | 3 | 1 | M | UX pravidlo: každá akce má viditelné potvrzení nebo chybu |
| 15 | **Přehled poukazů v adminu doplnit** o počet, celkovou hodnotu, blížící se konec platnosti | 3 | 1 | S | Základní přehled už je |
| 16 | **Vratka poukazu přes appku** (dnes ručně ve Stripe) | 2 | 1 | S | Až po právním výkladu odstoupení |

### P3 — později
| # | Úkol | Poznámka |
|---|---|---|
| 17 | **Kurz na míru / skupina nad 6:** přednastavená cena, automatický schvalovací e-mail s odkazem na platbu | Dnes řeší admin ručně |
| 18 | **Drobný prodej + QR + kiosk tablet:** tabulka zboží a zásob v appce, platba dynamicky přes Stripe, rezervace kusů jako u míst kurzů; hrnek zůstává testovací | Zásoby se hlídají u nás, ne ve Stripe |
| 19 | **Půjčovna** (rozhodnutí o ceně, kauci, délce) | Čeká na Milana |
| 20 | **Role Partner, samoobslužná registrace, tykání členům, slevy na kurzy.php** | Odloženo |

### Hotovo a nasazeno v main (Vercel zelený)
Členství přes Stripe (otestováno v sandboxu), storno přihlášky s vratkou (7+ dní 100 %, 3–6 dní 50 %, 0–2 dny 0 %), množstevní slevy (2 os. 5 %, 3–4 10 %, 5–6 15 %), betonový odlitek (počet 0 až N), firemní akce skryté na `/kurzy`, dvousloupcový admin, dárkové poukazy (`/poukazy`, uplatnění kódu na `/kurzy`, admin přehled; PR #1 a #2).

### Stav Stripe sandboxu (2026-10-20, ověřeno přes konektor)
Aktivní jen Členství v klubu (249 Kč měsíčně) a testovací Hrnek s logem (149 Kč); starý produkt „Modelování hlavy“ archivován. Webhook (6 událostí) a zákaznický portál jsou nastavené. Ceny kurzů, odlitků a poukazů se do Stripe katalogu nezakládají, počítá je server dynamicky. Konektor Stripe vidí zatím jen sandbox, ostrý účet se připojí přes „reconsent“ odkaz.

**Poznámky k práci:** vlákna z Cowork (Windows) a claude.ai (MacBook) jsou od 2026-10-20 sjednocená, pravdu drží repo a tato dokumentace. Vše kolem rezervační appky a Vercelu se řeší v jednom vláknu. Změny se zapisují do `zmeny.md`, po sloučení se ověřuje zelený build. Sloučení do `main` provádí Milan.
**Pravidlo nasazování (dohodnuto 2026-10-20):** změny kolem **plateb, rezervací, databáze a e-mailů** jdou vždy přes větev a Pull request, který po kontrole sloučí Milan (vrácení = jedno kliknutí). **Drobné změny textů a dokumentace** se mohou zapisovat rovnou do `main` (GitHub web editor, vlákno s Chromem). Vlákno v cloudu do `main` zapisovat nemůže, proto používá PR.

## (starší poznámka, nahrazeno předáním výše) ROZPRACOVÁNO 2026-10-19
**Dárkové poukazy na kurzy** (Milan schválil návrh):
- Hotovo a nasazeno: tabulka `vouchers` (lib/db.ts), `VOUCHER_COURSES` v lib/pricing.ts (hlava 8 270 Kč + odlitek 3 900, reliéf 6 470 Kč + odlitek 3 100, ceny za 1 osobu vč. DPH).
- Hotovo a SLOUČENO do main (PR #1 sloučen 2026-10-19 16:28, build zelený, nasazeno; udržované ve vláknu na jiném počítači): lib/vouchers.ts, POST /api/vouchers/checkout, webhook větev, e-maily, stránka /poukazy, uplatnění na /kurzy (POST /api/vouchers/redeem), admin přehled poukazů, skrytý panel Slevové stupně, zmeny.md.
- ZBÝVÁ: otestovat end-to-end ve Stripe sandboxu na preview nasazení (nákup bez termínu, s termínem, uplatnění kódu, plný termín, propadlý/uplatněný kód), pak sloučit do main po Milanově souhlasu; doladit texty (uiTexts, e-maily); PDF poukaz + vizuál; Milan dá odkaz /poukazy na web (PHP).
**Pořadí dál:** krok 4 správa textů v adminu, krok 3 potvrzovací e-mail při rezervaci člena. Ostrý Stripe provoz odložen.


Živý dokument — aktualizuj při každé netriviální změně priorit nebo po dokončení úkolu (stejná konvence jako zmeny.md). Cíl: kdykoli otevřené nové vlákno v tomhle projektu hned ví, na čem se pracuje a co je odloženo.

---

## Právě běží

**Obsahová revize webu, stránka po stránce.** Milan zvolil variantu "obsah teď, platby zvlášť později". Postup: projít web stránku po stránce a průběžně z toho vyplyne, co upravit/přidat/odebrat.

- Konkrétní stránka, kterou začít, je **zaparkovaná** — čeká se, až Milan řekne "jdeme na stránky". Nezahajovat sám od sebe.
- Součástí revize je i doladění/přepsání obsahu všech transakčních e-mailů (ne jen jejich katalogizace — ta je hotová, viz mapa-a-emaily.md).

## Odloženo na později (samostatný blok práce)

**Prodejní/objednávkové cesty s platbou.** Týká se pronájmu, kurzů, případně členství a merche. Zahrnuje: výběr platební brány, řešení DPH/fakturace, návrh checkout UX. Záměrně oddělené od obsahové revize — nezačínat, dokud to Milan výslovně neotevře.

## Starší odložené položky (z dřívějška, stále platí)

- Samoobslužná registrace členů.
- Neformální tykání v e-mailech pro členy (odlišit od formálních e-mailů žadatelům/veřejnosti).
- Živé zobrazení slevy pro skupinové objednávky přímo na kurzy.php.

## Drobnosti k doladění

- ICS feed (`/api/calendar.ics`): pole LOCATION obsahuje jen "Atelier na Pobřeží" bez přesné adresy — nepotvrzeno s Milanem, zvážit doplnění celé adresy (Na pobřeží 67, Kolín).
- **NUTNÁ OPRAVA (od Milana, 14. 10. 2026):** na veřejné stránce `/kurzy` jsou vypsané dvě **firemní akce** (Předvánoční coworkshop 26. 11. 2026 a Comp-any | Kreativní předvánoční podvečer 3. 12. 2026), na které se veřejnost **nesmí** přihlašovat ani platit. Řešení: u termínu kurzu přidat příznak (např. "soukromá/firemní akce", nevypsat veřejně) a nezobrazovat ho v `GET /api/courses` ani v `POST /api/signups` a `/api/signups/checkout` nepřijmout. Ještě před ostrým spuštěním plateb.

## Hotovo (jen pro kontext, detaily viz zmeny.md)

- Veřejná stránka: upozornění na kolizní termín, navigace v kalendáři (prev/next/Dnes).
- Admin: slevy pro skupinové objednávky přesunuty na konec stránky.
- Feed `/api/calendar.ics` pro Google/Apple kalendář, včetně tokenu a živých dat.
- Sitemap webu + kompletní seznam transakčních e-mailů zdokumentovány (viz `dokumentace/mapa-a-emaily.md`).

## Platební infrastruktura (připraveno, využít při řešení plateb)

Milan má založené a připravené:

- **Stripe účet** — plánovaná platební brána pro online platby (kurzy, pronájem, měsíční platby/členství, prodej drobných věcí).
- **Podnikatelský účet ve Fio bance** — určený jako **cílový účet pro projekt Ateliéru** (sem mají putovat výplaty ze Stripe a případné přímé platby).

Zatím se nic nenasazovalo ani nenapojovalo — jen podklad pro budoucí blok "Prodejní/objednávkové cesty s platbou" výše. Při jeho zahájení vycházet z toho, že brána = Stripe a cílový účet = Fio (nenavrhovat jiné brány, pokud Milan neřekne jinak). Čísla účtů, API klíče ani přístupy se do dokumentace nezapisují.

### Stripe — upřesnění zadání (od Milana)

- **Stav:** účet je zatím v režimu **sandbox** (testovací). Vše české, měna CZK.
- **Co má Stripe řešit:**
  - nákup kurzu (jednorázově),
  - pronájem ateliéru (jednorázově),
  - členství v klubu (**opakované/recurring platby**),
  - prodej drobných věcí z ateliéru (jednorázově), včetně **prodeje na místě**: QR kód → odkaz na online platbu kartou ve stylu "shopu", aby šlo vše zaplatit z mobilu na místě a nebylo potřeba pokladní řešení (motivace: vyhnout se EET/evidenci tržeb — ověřit aktuální stav legislativy).
- **Platební metody:** karty, Apple Pay, Google Pay (ideál, pokud to není výrazně dražší; hlavně aby šlo snadno zaplatit z mobilu).
- **Faktury:** řešit přes Stripe (jednodušší). Vznikne tím druhá číselná řada faktur vedle Caflou — Milan to nepovažuje za problém.
- **DPH:** Milan je **plátce DPH** (hodí se např. pro firemní akce) — ceny, faktury a Stripe Tax/DPH nastavení s tím počítat.
- **Časový plán:** testování v **říjnu**, ostrý provoz ideálně v **listopadu**.

### Stripe — stav implementace (14. 10. 2026)

**Hotovo (sandbox):** platba kurzu přes Stripe Checkout (`/kurzy` → "Zaplatit a rezervovat"), webhook, držení míst, auto-potvrzení, max 6 míst online, cena a sleva se počítají na serveru. Podrobnosti v `rezervace-system.md` (sekce Platby) a `zmeny.md`.

**Čeká na Milana:** webhook ve Stripe (URL `https://rezervace.ateliernapobrezi.cz/api/stripe/webhook`, události `checkout.session.completed` a `checkout.session.expired`) + env `STRIPE_WEBHOOK_SECRET` ve Vercelu + Redeploy; pak otestovat kartou 4242 4242 4242 4242 (kurz musí mít v adminu cenu a kapacitu).

**Testovací ceny ve Stripe (sandbox, price ID nejsou tajná):** Kurz 1 test `price_1UQN9oGY76GQEnXn9IePsYDC`, členství v klubu (měsíčně) `price_1UQNBGGY76GQEnXntdkgbUAf`, hrnek s logem `price_1UQNBlGY76GQEnXnnMgfMtHH`. Kurzy je nepoužívají (částka se počítá dynamicky); členství a drobný prodej je využijí. V ostrém režimu budou jiná ID.

**Další kroky (pořadí):**
1. Doladit a ověřit platbu kurzu (test v říjnu).
2. **Pronájem prostoru** (Milanovo zadání): zájemce pošle poptávku na termín → termín se **dočasně zablokuje** v kalendáři → admin schválí → zájemci přijde e-mail s odkazem na online platbu → po zaplacení se objeví finální blokace se jménem zájemce. **Otevřené rozhodnutí: na jak dlouho se po schválení drží blokace, než platba vyprší** (návrh 48 hodin) a co se stane po vypršení. Dnes `pending` žádost nic neblokuje, bude potřeba dočasná blokace.
3. Členství v klubu (recurring, Stripe Subscriptions + zákaznický portál pro zrušení).
4. Drobný prodej (hrnek atd.) včetně QR/platebního odkazu na místě; sklad (10 ks hrnků) hlídat v našem systému, ne ve Stripe.
5. Přechod na ostrý režim: ostré klíče, ověření účtu, napojení Fio účtu, DPH a faktury (ověřit s účetní číselné řady Stripe vs. Caflou).

**Dále potřeba rozhodnout/doplnit:** storno a vrácení peněz (podmínky), dárkové vouchery na kurzy (obchodní příležitost před Vánocemi; návrh v `kurzy-vouchery-specifikace.md`).

### Stav k 14. 10. 2026 (po testu platby)

**Otestováno (sandbox):** platba kurzu přes Stripe i webhook fungují, zelená hláška po platbě se zobrazuje. Google Pay se v sandboxu zatím nenabízel — ověřit při přechodu na ostrý režim (Stripe → Settings → Payment methods, karta v Google peněžence).

**Hotovo:** průvodce objednávkou kurzu ve 4 krocích se živou cenou a slevou (`/kurzy`, texty v `lib/uiTexts.ts`), potvrzovací hlášky v adminu (termín uložen, schválení/zamítnutí, sleva).

**Další kroky (pořadí):**
1. **Správa textů v adminu** (Milan je UX writer a chce texty ladit tónem a stylem): sekce v `/admin` nad `lib/uiTexts.ts` — seznam textů s popisem "kde se zobrazuje", pole pro úpravu, **náhled**, tlačítko vrátit výchozí; přepisy v DB (tabulka `ui_texts`), veřejné stránky je načítají. Do správy zařadit i hlášky a popisky z dalších stránek.
2. **Audit zpětné vazby** (pravidlo: každá akce admina i zákazníka musí mít viditelné potvrzení nebo chybu): zbývá správa členů, e-mailové šablony, úprava/smazání rezervace, rychlé přidání rezervace a veřejná stránka `/`.
3. **Nutná oprava:** skrýt firemní akce z veřejného `/kurzy` (viz Drobnosti).
4. Pronájem prostoru (poptávka → schválení → platba → blokace). **Telefon bude u pronájmu povinný** (zavoláme, domluvíme podmínky). U kurzů je telefon nepovinný.
5. Členství, drobný prodej/QR, ostrý režim Stripe.

**Technický dluh:** Next.js 14.2.5 je podle npm zastaralý (bezpečnostní upozornění) — naplánovat aktualizaci na záplatovanou verzi (potřebuje úpravu `package.json`/lockfile, zvážit mimo web GitHubu).

## Prodejní cesty — rozhodnutí od Milana (16. 10. 2026)

**Obecně:** platby a faktury řeší **Stripe** (faktury vytváří a ukládá Stripe). **Caflou se pro Ateliér nepoužije**; vznikne druhá číselná řada faktur vedle Milanových ostatních (Milan: "prý nevadí" — ověřit s účetní). Milan je plátce DPH. Web a ceny: CZK.

1. **Kurz, vypsaný termín (1–6 míst)** — hotovo v sandboxu. **Chybí storno a vrácení peněz:** zavést pravidla (zákazník nemůže stornovat v den účasti a dostat vše zpět; odstupňování podle počtu dní předem — konkrétní pravidla doplní Milan) a v adminu umět **vrátit peníze** (Stripe refund, i částečný).
2. **Kurz na míru / skupina nad 6** — schválení adminem zůstává. Ve Stripe **přednastavit produkt** pro tyto případy a doladit **automatický schvalovací e-mail** (s odkazem na platbu).
3. **Voucher / poukázka** — prodává se **obecná poukázka, ne na konkrétní kurz**. Držitel si pak sám vybere kurz a zarezervuje termín. (Starší návrh: `kurzy-vouchery-specifikace.md`; změna: žádný vázaný kurz.)
4. **Pronájem prostoru** — tok: poptávka → termín se dočasně zablokuje → admin schválí → e-mail s odkazem na platbu → po zaplacení finální blokace se jménem zájemce. **Telefon povinný.** Blokace se drží **2 pracovní dny** (Milan: "od schválení, tj. den objednávky + 2 pracovní dny" — upřesnit, zda se počítá od schválení, nebo od objednávky). **Celý ateliér = fixní cena** (v základu vybavení, úklid, omezené množství kávy/čaje) → **produkt ve Stripe**. **Levnější varianty:** ateliér bez vybavení, jen pingpong; u pingpongu varianta **s přístupem do ledničky a bez**. Ceny doplní Milan.
5. **Členství v klubu** — **249 Kč měsíčně vč. DPH**, opakovaná platba (Stripe Subscriptions). **Bez samoobslužné registrace** — jen prověření členové (zakládá admin). Členové si mohou **rezervovat ateliér na pingpong nebo jednotlivé stoly**; smysl: hlídat obsazenost, aby nikdo nelezl do klubovny, když tam je kurz.
6. **Drobný prodej** — **online shop zůstává skrytý**, žádné poštovné ani logistika. Potřeba: **pseudo-shop na naší doméně, zobrazený jen lokálně** (přehled prodávaných věcí v ateliéru). **QR kódy** u vystavených věcí i na obrazovce/tabletu s přehledem; platba kartou přes Stripe. **DPH: klasická česká sazba.** Sklad hlídat u nás (ne ve Stripe). Otevřené: jak technicky omezit zobrazení "jen lokálně" (nelinkovaná adresa, PIN, kiosk na tabletu).
7. **Firemní akce** — **na fakturu** (firmy si je dávají do nákladů), faktura ze Stripe; veřejně se nevypisují ani neplatí online.

### Upřesnění od Milana (19. 10. 2026)

- **Pronájem — lhůta na platbu:** počítá se **od schválení**, tj. od chvíle, kdy zájemci dorazí schvalovací e-mail. Má **2 pracovní dny** na zaplacení; termín je po tu dobu dočasně zablokovaný, po uplynutí se blokace uvolní.
- **Kurz, vypsaný termín:** platí se **hned** (žádná "bezpečná" lhůta; místa se drží jen po dobu platby, 35 min).
- **Storno kurzů (návrh Milana, potřebuje opravit překryv hranic):** 7 a více dní předem = vrácení 100 %; 2–6 dní = 50 %; méně než 3 dny = nic. Hranice "2 dny" je ve dvou pásmech → **SCHVÁLENO Milanem (19. 10. 2026): 7+ dní předem 100 %, 3–6 dní 50 %, 0–2 dny 0 %**. Admin musí umět **vrátit peníze** (celé i částečně, Stripe refund) a udělit výjimku.
- **Poukázka:** platnost **1 rok** od koupě. Poukázka je obecná (bez vázaného kurzu). Admin dashboard musí ukazovat **přehled koupených a nevyužitých poukázek** (počet, celková hodnota, blížící se konec platnosti).
- **Pseudo-shop (cesta 6):** zobrazí se jen **na tabletu v kiosk režimu** v ateliéru (ne veřejně).
- **DPH u poukázky:** Milan zjišťuje u účetní (jednoúčelová vs. víceúčelová poukázka).

### ÚKOL: Obchodní podmínky (VOP) a smluvní podmínky

Sepsat **srozumitelné** (lidským jazykem) a zároveň **právně správné** podmínky. **Právní správnost musí zkontrolovat český právník/advokát** — Claude není právník a nemá k dispozici nástroj pro české právo; návrh textu od Claude je jen podklad. Podmínky se zobrazí zákazníkovi před platbou (odkaz/souhlas v kroku shrnutí) a dostane je e-mailem.

Co musí pokrýt:
1. **Storno a vrácení peněz u kurzů** (pravidla výše; čas se počítá k začátku kurzu; jak se o storno žádá).
2. **Právo spotřebitele odstoupit do 14 dnů:** pro služby s pevně daným termínem (kurz) se podle dosavadního výkladu občanského zákoníku (§ 1837 písm. j)) neuplatní, **ale doslovné znění a použitelnost je nutné ověřit u právníka** (Claude to z dostupných zdrojů neověřil). U **poukázky** (bez pevného termínu) a u zboží se právo odstoupit pravděpodobně uplatní — ověřit.
3. **Poukázka:** platnost 1 rok, co se děje po uplynutí, přenositelnost, jak se uplatňuje (výběr kurzu a rezervace termínu), vrácení peněz.
4. **Pronájem:** blokace 2 pracovní dny od schválení, cena fixní (vybavení, úklid, omezená káva/čaj), varianty bez vybavení/jen pingpong, s ledničkou nebo bez; storno pronájmu.
5. **Členství:** 249 Kč měsíčně vč. DPH, opakovaná platba, jak se ruší, kdo je členem (jen prověření).
6. **Firemní akce:** platba na fakturu.
7. **Obecné náležitosti** e-shopu (identifikace prodávajícího, reklamace, ochrana osobních údajů/GDPR, řešení sporů).

### ÚKOL: Produkty a ceny ve Stripe (sandbox → ostrý režim)

Vytvořit produkty (kurzy na míru, pronájem celého ateliéru, varianty pronájmu, členství 249 Kč/měsíc vč. DPH (už založeno), poukázka, drobné zboží). Ceny doplní Milan. Ceny zadávat **s DPH (tax_behavior inclusive)** podle české sazby. Cesta: import CSV v Product catalog, nebo jednorázová admin akce v appce (konektor Stripe je od 2026-10-20 k dispozici, viz Stav Stripe sandboxu).

### Poznámky z 19. 10. 2026

- **Odstoupení do 14 dnů:** Milan postaví pro tuhle otázku vlastního právního agenta a dá vědět výsledek. Do té doby se v podmínkách nic nezakládá na domněnce (viz úkol Obchodní podmínky).
- **Ceny kurzů nejsou potřeba ve Stripe katalogu:** cena každého vypsaného termínu se zadává v adminu (pole cena) a platba kurzu si částku (včetně slevy) počítá dynamicky. Do Stripe katalogu patří jen produkty s pevnou cenou: kurz na míru, pronájem (celý ateliér a varianty), členství, poukázka, drobné zboží.
- **Seznam produktů s cenami s DPH sestaví Milan.**

### Členství — stav k 19. 10. 2026
- Hotovo (kód): platba předplatného přes Stripe, odkaz v uvítacím e-mailu, stav v adminu (Účty), odkaz „Členství“ pro přihlášeného člena (portál Stripe: karta, faktury, zrušení).
- Ke Stripe nastavit (Milan): ve Vercelu `STRIPE_MEMBERSHIP_PRICE_ID` (cena 249 Kč/měs. vč. DPH, recurring), do webhooku přidat události `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`; zapnout zákaznický portál (Settings → Billing → Customer portal); nastavit číslování faktur a údaje o firmě (Settings → Billing → Invoices).
- Při přechodu na ostrý provoz: vyměnit `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_MEMBERSHIP_PRICE_ID`; ve Stripe live znovu založit produkt s cenou, webhook a portál.
- Nápad (Milan, 19. 10. 2026): dashboard v adminu rezervací na širokých obrazovkách ve dvou sloupcích, na mobilu jeden sloupec.

### Stav k 19. 10. 2026 (večer)
- Členství: HOTOVO a otestováno v sandboxu (platba, zrušení, stav v Účtech, členství zdarma, děkovací stránka). Zbývá: zkontrolovat první fakturu ve Stripe (číslo, DPH 21 %, IČO/DIČ), aktivace Stripe účtu (probíhá, ověření totožnosti), při go-live vyměnit env `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_MEMBERSHIP_PRICE_ID`, `STRIPE_TAX_RATE_ID` (ostré sazba `txr_1USCoLGz8lhwKqiBQghyaobW`).
- Rozhodnuto: účtování členství ke dni přihlášení (bez poměrných faktur); role „Partner“ odložena; výplaty ze Stripe měsíčně.
- Další na řadě (návrh): dvousloupcový dashboard v adminu na širokých obrazovkách; potvrzovací e-mail při vytvoření rezervace členem; správa textů v adminu; skrytí dvou firemních akcí z /kurzy; storno a refundy.
