# Dokumentace — Ateliér na pobřeží

Rozcestník dokumentace pro dva propojené systémy webové prezentace atelieru.

## Dva systémy

1. **[web-ateliernapobrezi.md](./web-ateliernapobrezi.md)** — statický PHP web na `ateliernapobrezi.cz`. Vizitka, kurzy, pronájem, kontakt, mini CMS pro texty. Hostováno na Forpsi, nasazuje se přes FTP, **není v gitu**.
2. **[rezervace-system.md](./rezervace-system.md)** — rezervační systém na `rezervace.ateliernapobrezi.cz`. Next.js appka, Neon Postgres, e-maily přes Resend, nasazená na Vercelu. **Je v gitu**, tady v repu `atelier-rezervace`, každý push do `main` appku automaticky nasadí.

Oba systémy jsou propojené: `kurzy.php` na hlavním webu si živě natahuje vypsané termíny kurzů z `/api/courses` rezervačního systému.

V repu `atelier-rezervace` je i starší návrhový dokument `kurzy-vouchery-specifikace.md` (plnohodnotný voucherový systém) — realizovaný byl jen jeho slevový tier systém, viz vysvětlení v `rezervace-system.md`.

## [zmeny.md](./zmeny.md)

Průběžný log novinek a změn — datované záznamy, co se kdy udělalo a proč. Nová položka se přidává při každé netriviální změně (nová funkce, oprava chyby, změna chování). Součástí skillu pro správu webu.

## Přístupy a přihlašování

- **GitHub** (`milansvolba/atelier-rezervace`) — kód rezervačního systému, editace přes webový editor GitHubu (commit do `main` = automatický deploy na Vercelu).
- **FTP** (`net2ftp` na `https://webftp.forpsi.com`, server `ftpx.forpsi.com`, uživatel `www.ateliernapobrezi.cz`) — soubory hlavního webu. Přihlašovací heslo zadává vždy Milan sám, nikdy ne Claude.
- **admin.php** — heslem chráněné mini CMS hlavního webu pro editaci textů. Heslo zadává vždy Milan sám.
- **Vercel** — hosting rezervačního systému, env proměnné (`DATABASE_URL`, `AUTH_SECRET`, `RESEND_API_KEY`, `ADMIN_EMAILS`, `NEXT_PUBLIC_APP_URL`).
- **Neon Postgres** — databáze rezervačního systému (rezervace, přihlášky, účty, e-mailové šablony, log e-mailů, slevové tiery).
- **Resend** — odesílání e-mailů z rezervačního systému.

## Jak dokumentaci udržovat aktuální

Při každé netriviální změně na webu nebo v rezervačním systému:

1. Zapsat krátký záznam do `zmeny.md` (datum, co, proč, kde).
2. Pokud změna mění architekturu/strukturu/flow (ne jen text nebo drobnou opravu), promítnout ji i do `web-ateliernapobrezi.md` nebo `rezervace-system.md`.

Toto je automatizované skillem pro správu webu — viz jeho popis.

