# Novinky a změny

Průběžný log — nejnovější nahoře. Každý záznam: datum, co se změnilo, proč/kontext, kde (web / rezervace / obojí).

Historie do 13. 8. 2026 je zpětně sepsaná souhrnně (podle dokončených úkolů), jednotlivé dřívější kommity a přesné časy viz historie repozitáře na GitHubu.

---

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

