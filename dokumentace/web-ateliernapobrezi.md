# Web ateliernapobrezi.cz

Statický PHP web s jednoduchým vlastním mini CMS pro texty. **Není v gitu** — žije jen na hostingu, edituje se přímo na produkci přes FTP. Žádný staging/test prostor: jakákoli úprava souboru je hned živá.

## Hosting a přístup

- Hosting: Forpsi, FTP server `ftpx.forpsi.com`, uživatel `www.ateliernapobrezi.cz`.
- Editace: přes webové FTP rozhraní `net2ftp` (`https://webftp.forpsi.com`) — umí prohlížet strom souborů a soubory přímo v prohlížeči zobrazit/upravit (tlačítka *View* / *Edit*).
- Heslo do FTP zadává vždy Milan sám (Claude z bezpečnostních důvodů nikdy nezadává přihlašovací údaje).

## Struktura souborů (`/www`)

```
/www
├── index.php              # Úvodní stránka
├── kurzy.php               # Kurzy — živě natahuje termíny z rezervačního systému
├── pronajem.php            # Pronájem prostoru
├── kontakt.php             # Kontakt
├── lide.php                 # Lidé (kdo ateliér vede)
├── obchod.php               # Obchod / pseudogalerie (zatím skrytý z menu)
├── reference.php             # Reference (scaffold)
├── admin.php                 # Mini CMS — editace textů z data/content.json
├── index_forpsi.php          # Výchozí placeholder stránka hostingu, nepoužívá se
├── .htaccess                  # Přesměrování bez .php přípony (clean URLs) + další pravidla
├── robots.txt
├── script.js                  # Sdílený JS (mobilní menu apod.)
├── styles.css                 # Sdílené styly
├── images/                    # Statické obrázky
├── inc/                       # Sdílené PHP includy (hlavička/patička, načítání obsahu z content.json)
└── data/                      # Úložiště CMS obsahu a admin autentizace — chráněno vlastním .htaccess proti přímému přístupu z webu
    ├── content.json            # Veškerý editovatelný text webu jako ploché klíč–hodnota páry (viz níže)
    ├── admin_auth.php           # Ověření hesla pro admin.php
    ├── admin_login_attempts.php # Evidence neúspěšných pokusů o přihlášení (rate limiting)
    └── .htaccess                # Blokuje přímý webový přístup do /data
```

## Mini CMS (`admin.php` + `data/content.json`)

Žádná databáze — veškerý editovatelný text webu je v jednom plochém JSON souboru `data/content.json` jako dvojice `"klic": "text"`, např.:

```json
{
  "hero_kurzy_title1": "Umažte si ruce.",
  "course1_name": "Modelování hlavy",
  "course1_price": "od 5 999 Kč",
  "contact_email": "info@ateliernapobrezi.cz",
  "contact_phone": "+420 724 241 721"
}
```

`admin.php` je heslem chráněný formulář, který tyto hodnoty umožňuje upravovat bez zásahu do kódu. Jednotlivé stránky (`index.php`, `kurzy.php`, `pronajem.php`, ...) si texty čtou z `content.json` přes pomocné funkce v `inc/`.

**Zabezpečení admin.php:**
- Heslo ověřuje `data/admin_auth.php`.
- Neúspěšné pokusy o přihlášení eviduje `data/admin_login_attempts.php` a po překročení limitu dočasně blokuje další pokusy (rate limiting) — dřívější chyba v této logice byla opravena.
- Samotná složka `data/` má vlastní `.htaccess`, který blokuje přímý přístup zvenčí (nejde si stáhnout `content.json` ani `*.php` soubory uvnitř přímo z URL).
- Claude do `admin.php` heslo nikdy nezadává — end-to-end test provádí vždy Milan sám.

## Clean URLs

`.htaccess` v kořeni `/www` přepisuje adresy bez přípony `.php` na skutečné soubory, takže se používá např. `/kurzy` místo `/kurzy.php`. Platí pro všechny hlavní stránky.

## Propojení s rezervačním systémem

`kurzy.php` při načtení stránky volá veřejné API `GET /api/courses` na `rezervace.ateliernapobrezi.cz` (viz [rezervace-system.md](./rezervace-system.md)) a zobrazuje aktuálně vypsané, potvrzené a budoucí termíny kurzů — název, datum, čas, cenu, volnou kapacitu.

Kurzy se na stránce seskupují podle společného názvu do "témat" (např. všechny termíny "Modelování reliéfu" patří pod jedno téma). U tématu je tlačítko **Koupit**, které nabídne volbu:
- **Pro jednotlivce** → zobrazí filtrovaný seznam vypsaných termínů daného tématu, návštěvník se přihlásí na konkrétní termín (formulář přihlášky, viz `/api/signups` v rezervačním systému).
- **Pro skupinu** → přesměruje na formulář poptávky vlastního termínu (`/api/requests` v rezervačním systému) — skupina si termín domlouvá individuálně.

Pokud aktuálně nejsou vypsané žádné termíny, zobrazí se informace "Momentálně nemáme vypsaný žádný termín" a nabídka poptávky vlastního termínu pro skupinu.

## Menu

Hlavní i patičkové menu: Domů, Kurzy, Pronájem prostoru, Kontakt. Položka **Rezervovat** byla z hlavičky odstraněna (CTA na rezervaci je silněji umístěné přímo na stránce Pronájem). Položka **Obchod** je z obou menu schovaná — stránka `obchod.php` existuje, ale zatím bez odkazu, čeká na dokončení prodeje děl umělců (pseudogalerie).

## Stav jednotlivých stránek

- **Kurzy** — hotovo: live termíny z rezervačního systému, výběr tématu (jednotlivec/skupina), skupinové slevy počítané v rezervačním systému.
- **Pronájem prostoru** — obohaceno, silnější CTA.
- **Lidé** — hotovo, vlastní CMS pole v `content.json`.
- **Reference** — scaffold hotový (stránka + pruh referencí u Kurzů), obsah čeká na skutečné reference od Milana.
- **Obchod / pseudogalerie** — odloženo, čeká na rozhodnutí o prodeji děl umělců.
- **Fotky na klíčových místech** — čeká na skutečné fotky od Milana.
- **Sociální sítě / Instagram feed** — čeká na handle od Milana.

