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
├── kurzy.php               # Kurzy — rozcestník, odkazuje na detailní stránky níže
├── kurz-modelovani-hlavy.php # Detail kurzu Modelování hlavy
├── kurz-relief.php          # Detail kurzu Modelování reliéfu
├── pronajem.php            # Pronájem prostoru
├── kontakt.php             # Kontakt
├── o-atelieru.php           # O ateliéru (příběh, upcyklace, lidé; dříve stránka „Lidé“)
├── lide.php                 # Jen trvalé přesměrování 301 na /o-atelieru
├── firemni-akce.php          # Firemní akce
├── obchod.php               # Obchod / pseudogalerie (zatím skrytý z menu)
├── reference.php             # Reference (scaffold)
├── admin.php                 # Mini CMS — editace textů z data/content.json
├── index_forpsi.php          # Výchozí placeholder stránka hostingu, nepoužívá se
├── 404.php                   # Vlastní chybová stránka (404) s mini-rozcestníkem, viz sekce níže
├── .htaccess                  # Přesměrování bez .php přípony (clean URLs) + další pravidla + ErrorDocument 404 + bezpečnostní HTTP hlavičky (viz sekce Chybová stránka níže)
├── robots.txt
├── sitemap.xml                # XML mapa webu (12 URL), odkazovaná z robots.txt
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
- **Zapomenuté heslo:** nahraj přes FTP do `data/` prázdný soubor s názvem `RESET_PASSWORD` a otevři `admin.php` — místo přihlášení se zobrazí formulář na nastavení nového hesla (bez nutnosti znát to staré, FTP přístup je dostatečný důkaz vlastnictví). Po nastavení hesla appka soubor sama smaže. Nové heslo zadává vždy Milan přímo do formuláře, nikdy ne přes Claude.

## Clean URLs

`.htaccess` v kořeni `/www` přepisuje adresy bez přípony `.php` na skutečné soubory, takže se používá např. `/kurzy` místo `/kurzy.php`. Platí pro všechny hlavní stránky. Platí i pro nové stránky `kurz-modelovani-hlavy` a `kurz-relief`.

## Chybová stránka (404) a přístupnost

Od 23. 10. 2026 má web vlastní 404 stránku místo defaultní hostingové: `.htaccess` má direktivu `ErrorDocument 404 /404`, což projde přes standardní clean-URL přepisovací pravidla (interně se namapuje na `404.php`) a Apache si při tomhle interním přesměrování sám drží HTTP status 404. `404.php` je postavená na stejné šabloně jako ostatní stránky (`render_main_nav()`, `render_footer()` apod.) a obsahuje mini-rozcestník s dlaždicemi na Kurzy, Pronájem ateliéru a Firemní akce plus odkaz na dárkové poukazy — a v textu pod nadpisem jsou klíčová slova prolinkovaná na stejné stránky.

**Přístupnost (skip-link):** všech 13 veřejných stránek má na začátku `<body>` odkaz `<a href="#main" class="skip-link">Přeskočit na obsah</a>` a hned za `</header>` prázdný `<div id="main"></div>` — standardní technika pro uživatele klávesnice, aby mohli přeskočit opakovanou navigaci. Styl `.skip-link` je v `styles.css` (skrytý mimo fokus, viditelný po navigaci klávesnicí na `:focus`).

**HTTP security hlavičky:** `.htaccess` nastavuje přes `mod_headers` `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin` a `Permissions-Policy: geolocation=(), microphone=(), camera=()`. Vědomě vynechané: Content-Security-Policy (vyžadovalo by pečlivé allowlistování GA/Clarity/Stripe/Google Fonts, vysoké riziko, že něco rozbije) a HSTS (riziko dopadu na subdomény jako `rezervace.ateliernapobrezi.cz`, pokud by nebyly všechny jistě HTTPS-ready).

**Sitemap:** `sitemap.xml` v kořeni `/www` (standardní `<urlset>` se `<loc>`/`<lastmod>` pro 12 hlavních URL, bez `/obchod`, `/lide` a `/404`) je odkazovaná z `robots.txt` řádkem `Sitemap: https://www.ateliernapobrezi.cz/sitemap.xml`. Při přidání, odebrání nebo přesunu stránky ve struktuře webu je potřeba `sitemap.xml` ručně aktualizovat (pravidlo je i ve skillu `atelier-sprava-webu`) — stává se to jen zřídka.

## Propojení s rezervačním systémem

`kurzy.php` zobrazuje aktuálně vypsané, potvrzené a budoucí termíny kurzů — název, datum, čas, cenu, volnou kapacitu — z veřejného API `GET /api/courses` na `rezervace.ateliernapobrezi.cz` (viz [rezervace-system.md](./rezervace-system.md)). Od 20. 8. 2026 web výsledek cachuje do `data/courses_cache.json` (TTL 5 minut), aby stránka nečekala na živé volání Vercelu při každém načtení: je-li cache čerstvá, čte se rovnou z ní; jinak proběhne živé volání s timeoutem 3 s a cache se přepíše; při selhání živého volání se použije poslední známá cache, nebo prázdný výsledek, pokud cache ještě neexistuje.

Od 20. 8. 2026 navíc appka rezervace po každé změně rezervace/termínu (vytvoření, úprava, smazání) pošle na web webhook (`POST /webhook-invalidate`, ověřený sdíleným tajemstvím v hlavičce `X-Webhook-Secret`), který rovnou vynutí přepočet cache (`refresh_courses_cache()` v `inc/courses_cache.php`, sdíleném s `kurzy.php`) — změna se tak na Kurzy projeví prakticky okamžitě, ne až po vypršení 5min TTL. Sdílený tajný klíč je uložený v `data/webhook_secret.php` (soubor ho jen `return`-uje jako řetězec, nikdy ho nevypisuje) a jako proměnná `WEBHOOK_SECRET` ve Vercel nastavení appky rezervace. Detaily k appce rezervace a odesílání webhooku viz [rezervace-system.md](./rezervace-system.md).

**Struktura Kurzy (od 20. 8. 2026):** `kurzy.php` je rozcestník — hero, karty obou kurzů, sekce "Co vás čeká", profil lektora a FAQ. Karta každého kurzu má tlačítko **Zobrazit detail a termíny**, které vede na vlastní detailní stránku (`kurz-modelovani-hlavy.php` / `kurz-relief.php`). Detailní stránka má vlastní úvodní text (`course1_detail_intro`/`course2_detail_intro` v `content.json`), fotky (`img_src()` s placeholderem, dokud Milan nenahraje `images/course1_1.jpg` atd. přes FTP), termíny filtrované klíčovým slovem podle kurzu z `get_cached_courses()`, reference filtrované stejně z `build_testimonials()` a vlastní přesný `Course` schema.org blok. Odkaz u termínů vede přímo na `rezervace.ateliernapobrezi.cz` — žádný modál ani volba jednotlivec/skupina na webu není, to řeší formuláře přímo v rezervačním systému.

Pokud u kurzu aktuálně nejsou vypsané žádné konkrétní termíny, detailní stránka zobrazí obecný odkaz na rezervační kalendář místo prázdného seznamu.

## Menu a patička

Hlavní menu i patička se generují společnými funkcemi v `inc/content.php` (`render_main_nav()`, `render_footer()`); stránky jen volají `<?= render_main_nav() ?>` a `<?= render_footer() ?>`. Výjimka: skrytá `obchod.php` má pořád statické menu i patičku. Obsah menu a odkazů v patičce se upravuje v dolní liště přihlášeného admina tlačítky **Upravit menu** a **Upravit patičku**.

- Data v `data/content.json`: `main_menu` (hlavní menu), `footer_menu` (sloupec Navigace v patičce) a `footer_contact` (sloupec Kontakt). Jsou to JSON seznamy položek `{label, target, url?}`. `target` je klíč z registru `internal_link_targets()` (jen stránky, které existují jako `.php` soubor, kontroluje `menu_target_exists()`), `custom` (vlastní adresa v `url`: `https://…`, `mailto:`, `tel:`, `#kotva`) nebo `none` (jen text bez odkazu, jen v patičce). Prázdná hodnota = výchozí seznam (`menu_default_items()`, `footer_default_items()`; kontakty v patičce se drží podle `contact_*`, dokud se neupraví).
- Texty patičky (`footer_brand_heading`, `footer_tagline`, `footer_nav_heading`, `footer_contact_heading`, `footer_copyright`) se upravují inline jako ostatní texty.
- Výchozí hlavní menu: Domů, Kurzy, Pronájem prostor, Firemní akce, O ateliéru, Kontakt. Položka **Obchod** je schovaná — stránka `obchod.php` existuje, ale zatím bez odkazu, čeká na dokončení prodeje děl umělců (pseudogalerie). Odkaz na **Rezervace** je v patičce.
- Nová stránka do menu: vytvořit soubor `xyz.php`, přidat záznam do `internal_link_targets()` v `inc/content.php`, pak ji vybrat v editoru menu.

## Odkazy, odstavce a video v textech (inline editace)

- **Odkaz v textu:** `[text](cíl)` — cíl je `#kotva`, `stranka#kotva`, klíč z `internal_link_targets()`, `https://…` (otevře se v novém okně), `mailto:` nebo `tel:`. Řeší `t_link_markup()`; vstup se nejdřív escapuje, nepovolené cíle zůstanou textem. Kotvy mají globálně `scroll-margin-top: 96px`.
- **Odstavce:** Enter v edit módu = nový odstavec (`\n\n` → `<br><br>`), Shift+Enter = nový řádek (`\n` → `<br>`).
- **Edit mód:** třída `t-editing` na `body`; odkazy se v něm neotevírají (globální capture-listener na kliknutí), takže jde klikat do textu uvnitř odkazů a karet.
- **Klikatelné karty:** třída `card-clickable` a poslední `<a>` přímo v kartě (`::after` přes celou kartu); v edit módu se překryv vypíná.
- **Video:** `render_editable_video($klíč, $titulek)` — YouTube odkaz uložený pod klíčem; veřejně se nezobrazí, dokud není vyplněný; admin má tlačítka Přidat/Změnit/Odebrat. Iframe `youtube-nocookie.com` se načte až po kliknutí. Použité klíče: `kurz_relief_video`, `kurz_hlavy_video`, `oat_makingof_video`.

## Stav jednotlivých stránek

- **Kurzy** — hotovo: `kurzy.php` jako rozcestník + vlastní detailní stránka pro každý kurz (live termíny, reference, schema.org), skupinové slevy počítané v rezervačním systému. Fotky u detailních stránek čekají na Milana (zatím placeholder).
- **Pronájem prostoru** — obohaceno, silnější CTA.
- **O ateliéru** — hotovo (dříve „Lidé“, `/lide` přesměrovává trvale 301): příběh, sekce o upcyklaci, Making of video (`#making-of`) a lidé (`#petr`, `#milan`); texty v CMS `oat_*`, `lide_*`, `person_*`.
- **Firemní akce** — hotovo (`firemni-akce.php`), v menu i na Home.
- **Kontakt** — formulář, údaje a sekce „Jak se k nám dostat“ (`#jak-se-k-nam`); nákres cesty od nádraží a foto vchodu čekají na Milana.
- **Reference** — scaffold hotový (stránka + pruh referencí u Kurzů), obsah čeká na skutečné reference od Milana.
- **Obchod / pseudogalerie** — odloženo, čeká na rozhodnutí o prodeji děl umělců.
- **Fotky na klíčových místech** — čeká na skutečné fotky od Milana.
- **Sociální sítě / Instagram feed** — čeká na handle od Milana.

