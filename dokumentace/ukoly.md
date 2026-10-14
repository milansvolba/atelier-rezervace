# Seznam úkolů a stav

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
