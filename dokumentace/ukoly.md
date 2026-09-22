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
