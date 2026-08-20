# Novinky a změny

Průběžný log — nejnovější nahoře. Každý záznam: datum, co se změnilo, proč/kontext, kde (web / rezervace / obojí).

Historie do 13. 8. 2026 je zpětně sepsaná souhrnně (podle dokončených úkolů), jednotlivé dřívější kommity a přesné časy viz historie repozitáře na GitHubu.

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
