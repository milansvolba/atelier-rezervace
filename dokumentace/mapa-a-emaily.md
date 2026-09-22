# Mapa webu a přehled transakčních e-mailů

Referenční dokument pro rychlou orientaci na začátku nového vlákna — kde co na webu je a jaké e-maily systém posílá. Aktualizuj při každé netriviální změně struktury webu nebo e-mailů (viz zmeny.md).

---

## Mapa webu — ateliernapobrezi.cz (hlavní statický web, FTP/PHP)

- **Domů** (`index.php`)
- **Kurzy** (`kurzy.php`) — hotovo
  - Kurz modelování hlavy (`kurz-modelovani-hlavy.php`)
  - Kurz reliéfu (`kurz-relief.php`)
- **Pronájem prostoru** (`pronajem.php`) — obohaceno, silnější CTA
- **Kontakt** (`kontakt.php`)
- **Lidé** (`lide.php`) — hotovo
- **Reference** (`reference.php`) — jen scaffold, obsah zatím chybí
- **Obchod** (`obchod.php`) — hotovo technicky, ale skryté z menu (čeká na rozhodnutí o pseudo-galerii)
- `admin.php` — mini CMS, čte/zapisuje `data/content.json`, heslem chráněné
- `index_forpsi.php` — nepoužívaný placeholder, ignorovat

Menu: Domů / Kurzy / Pronájem prostoru / Kontakt (položka "Rezervovat" odstraněna, "Obchod" skryté).

## Mapa webu — rezervace.ateliernapobrezi.cz (Next.js appka, GitHub + Vercel)

- `/` — veřejná rezervační stránka (kalendář s navigací, formulář žádosti, upozornění na kolizní termín)
- `/admin` — administrace: rezervace, kurzy, přihlášky na kurzy, slevy pro skupiny, e-mailové šablony, log odeslaných e-mailů
- `/api/calendar.ics` — ICS feed pro Google/Apple kalendář (token přes query string, vždy čerstvá data)
- Přihlašování přes magic link (e-mail s jednorázovým odkazem), bez klasické stránky s heslem

---

## Seznam transakčních e-mailů (16 typů)

Zdroj: `lib/emailTemplates.ts` (šablony) + `lib/email.ts` (odesílací logika). Editovatelné šablony jde upravit v adminu (Šablony e-mailů); systémové ne (bezpečnostně citlivé).

### Editovatelné v adminu — 14

1. **Admin: nová poptávka na kurz** — adminům při poptávce na skupinový kurz na míru. Obsah: jméno, termín, čas, poznámka, kontakt, odkaz do adminu.
2. **Admin: nová žádost o pronájem** — adminům při žádosti o pronájem/rezervaci místa. Obsah: jméno, co, termín, čas, poznámka, kontakt, odkaz do adminu.
3. **Žadatel: poptávka na kurz přijata** — potvrzení žadateli hned po odeslání poptávky na kurz.
4. **Žadatel: žádost o pronájem přijata** — potvrzení žadateli hned po odeslání žádosti o pronájem.
5. **Žadatel: kurz potvrzen** — po schválení; obsahuje adresu (Na pobřeží 67, Kolín) a co s sebou.
6. **Žadatel: kurz nelze potvrdit** — po zamítnutí; výzva napsat jiný termín.
7. **Žadatel: pronájem potvrzen** — po schválení žádosti o pronájem.
8. **Žadatel: pronájem nelze potvrdit** — po zamítnutí.
9. **Rezervista: termín změněn** — když admin ručně upraví existující rezervaci/kurz; ukazuje původní i nový termín.
10. **Rezervista: termín zrušen** — když admin smaže rezervaci/kurz.
11. **Admin: nová přihláška na kurz** — adminům, když se někdo přihlásí na vypsaný termín kurzu na /kurzy.
12. **Přihlášený: přihláška přijata** — potvrzení hned po přihlášení na vypsaný termín kurzu.
13. **Přihlášený: místo potvrzeno** — po schválení přihlášky.
14. **Přihlášený: místo nelze potvrdit** — po zamítnutí (typicky plná kapacita).

### Systémové, needitovatelné — 2

15. **Přihlašovací odkaz (magic link)** — jednorázový odkaz platný 15 minut, pro admina i člena.
16. **Uvítací e-mail** — při založení nového účtu, rovnou s přihlašovacím odkazem.

---

*Poznámka: LOCATION v ICS feedu (`/api/calendar.ics`) aktuálně obsahuje jen "Atelier na Pobřeží" bez přesné adresy — nepotvrzeno s Milanem, zvážit doplnění.*

