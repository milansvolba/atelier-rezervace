# Specifikace: nákup kurzu odděleně od výběru termínu (vouchery) + skupinové nákupy

Stav: návrh k připomínkování, zatím bez napojení platební brány (viz sekce Platba).

## Proč

Dnešní flow (`app/kurzy/page.tsx`, `/api/signups`) váže přihlášku vždy na konkrétní vypsaný termín (`Booking` s `category: "kurz"`). To nepokrývá dva reálné případy:

1. Někdo chce kurz koupit jako dárek, aniž by v tu chvíli vybíral termín — obdarovaný si termín zvolí sám později.
2. Skupinový nákup (rodina, firma, parta přátel) — `CourseSignup.people` už existuje a group signup na konkrétní termín funguje, ale nákup bez termínu ne.

## Nový datový typ: `CourseOrder`

Doplnit do `lib/types.ts` vedle stávajícího `CourseSignup`:

```ts
export type OrderStatus = "pending_payment" | "paid" | "redeemed" | "cancelled" | "expired";

export interface CourseOrder {
  id: string;
  code: string;              // krátký kód pro zákazníka a variabilní symbol platby, např. "KURZ-7F3K9"
  courseTitle: string;       // typ kurzu v době nákupu (např. "Modelování hlavy")
  people: number;            // počet osob (skupinový nákup)
  buyerName: string;
  buyerContact: string;
  isGift: boolean;
  giftRecipientName?: string;
  giftMessage?: string;
  pricePerPerson: number;    // zamrzlá cena v době nákupu, aby pozdější změna ceníku neovlivnila už koupené vouchery
  totalPrice: number;
  status: OrderStatus;
  paymentMethod?: "bank_transfer" | "gateway";
  paidAt?: string;
  redeemedBookingId?: string; // vyplní se při uplatnění na konkrétní vypsaný termín
  redeemedAt?: string;
  expiresAt?: string;         // platnost voucheru, návrh: 12 měsíců od zaplacení
  note?: string;
  createdAt: string;
}
```

## DB schéma (`lib/db.ts`, `ensureSchema`)

Nová tabulka analogická `course_signups`:

```sql
CREATE TABLE IF NOT EXISTS course_orders (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  course_title text NOT NULL,
  people integer NOT NULL DEFAULT 1,
  buyer_name text NOT NULL,
  buyer_contact text NOT NULL,
  is_gift boolean NOT NULL DEFAULT false,
  gift_recipient_name text,
  gift_message text,
  price_per_person integer NOT NULL,
  total_price integer NOT NULL,
  status text NOT NULL DEFAULT 'pending_payment',
  payment_method text,
  paid_at timestamptz,
  redeemed_booking_id text REFERENCES bookings (id) ON DELETE SET NULL,
  redeemed_at timestamptz,
  expires_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS course_orders_code_idx ON course_orders (code);
CREATE INDEX IF NOT EXISTS course_orders_status_idx ON course_orders (status);
```

`lib/orders.ts` — nový soubor v stejném stylu jako `lib/signups.ts` (`store`-like objekt s `all`, `byCode`, `add`, `updateStatus`, `markRedeemed`).

## API endpointy

- **`POST /api/orders`** (veřejné) — vytvoří objednávku, stav `pending_payment`, vygeneruje unikátní `code`. Pošle e-mail kupujícímu (potvrzení + platební instrukce: číslo účtu, částka, variabilní symbol = `code`) a adminovi (nová objednávka čeká na platbu) — stejný vzor jako `sendAdminNewSignupEmail` / `sendSignupReceivedEmail`.
- **`GET /api/orders`** (admin, `requireAdmin`) — seznam objednávek pro admin frontu, stejně jako `GET /api/signups`.
- **`PATCH /api/orders/[id]`** (admin) — změna stavu. Při přechodu na `paid`: nastaví `paidAt`, `expiresAt` (+12 měsíců), pošle kupujícímu e-mail s voucher kódem a odkazem na uplatnění. Při `cancelled`: pošle info e-mail.
- **`POST /api/orders/redeem`** (veřejné) — tělo `{ code, bookingId }`. Ověří: objednávka existuje, `status === "paid"`, není expirovaná, cílový `Booking` má `category: "kurz"` a dost volné kapacity pro `order.people` (přes `signupStore.confirmedPeopleForBooking`). Pokud OK: vytvoří `CourseSignup` se `status: "confirmed"` (už je zaplaceno, netřeba schvalovat), nastaví na objednávce `status: "redeemed"`, `redeemedBookingId`, `redeemedAt`. Pošle potvrzovací e-mail.

Důležité: `PATCH /api/orders/[id]` s přechodem na `paid` je záměrně oddělený krok od samotné platby — dnes ho spouští ručně admin (viz Platba níže), zítra ho může spustit webhook platební brány beze změny zbytku flow.

## UI — veřejná stránka `/kurzy`

Rozšířit `app/kurzy/page.tsx`:

- U každého vypsaného termínu vedle "Přihlásit se" přidat druhé tlačítko "Koupit / darovat" (jen pokud `spotsLeft` neomezuje — u koupě bez termínu se kapacita neváže na konkrétní běh).
- Formulář: jméno, kontakt, počet osob, checkbox "Kupuji jako dárek" → rozbalí pole jméno obdarovaného + vzkaz (nepovinné), přepínač "Termín vyberu hned" / "Termín vyberu později (přijde voucher e-mailem)".
  - Pokud "hned": po odeslání se rovnou volá i redeem logika na vybraný `bookingId` (ale až ve chvíli, kdy je objednávka `paid` — tedy zůstává ve dvou krocích: objednávka → platba → teprve pak vznikne signup).
  - Pokud "později": žádný `bookingId`, objednávka čeká na uplatnění.
- Odešle na `POST /api/orders`.

Nová stránka **`/kurzy/uplatnit`**: pole pro zadání kódu voucheru → po ověření (`GET` na nový lehký endpoint nebo přes `redeem` s dry-run parametrem) zobrazí stejný seznam vypsaných termínů jako `/kurzy` → tlačítko "Vybrat tento termín" volá `POST /api/orders/redeem`.

## UI — admin (`app/admin/page.tsx`)

Nová sekce "Objednávky kurzů" vedle stávající fronty přihlášek (`course_signups`): tabulka se stavy, u `pending_payment` tlačítko "Označit jako zaplaceno" (ručně, dokud není napojená brána), u všech tlačítko "Zrušit". Zvýraznit blížící se expiraci (`expiresAt` do 30 dnů).

## E-mailové šablony (`lib/emailTemplates.ts`, `lib/email.ts`)

Čtyři nové, ve stylu stávajících (`sendSignupReceivedEmail` apod.):

1. `orderReceived` — kupujícímu, potvrzení + platební instrukce.
2. `adminNewOrder` — adminovi, nová objednávka.
3. `orderPaidVoucher` — kupujícímu, voucher kód + odkaz na `/kurzy/uplatnit` + platnost.
4. `voucherRedeemed` — kupujícímu (a případně adminovi), potvrzení vybraného termínu.

Všechny přes stávající `email_log` mechanismus (log úspěchu/chyby odeslání).

## Platba — co je připravené, co ne

Teď: žádná brána napojená. `POST /api/orders` vytvoří objednávku se stavem `pending_payment` a pošle platební instrukce k bankovnímu převodu (VS = kód objednávky) — obdobně jako se dnes řeší přístup nových členů (ruční založení adminem). Admin platbu ručně potvrdí v adminu.

Později: napojení GoPay/ComGate/Stripe (rozhodnutí odložené) změní jen to, *co* volá `PATCH /api/orders/[id]` na `paid` — místo ručního kliknutí admina to udělá webhook brány po úspěšné platbě. Zbytek flow (voucher, uplatnění, e-maily) zůstává stejný. Až se brána vybere, přidá se `POST /api/orders/[id]/checkout` který založí platbu u brány a přesměruje kupujícího.

## Otevřené otázky pro Milana

- Platnost voucheru 12 měsíců, nebo jinak?
- Cena za skupinu: `pricePerPerson × people`, nebo chceš mít možnost slevy za skupinu?
- Má jít koupit i "kurz na míru" (bez vypsaného termínu vůbec, viz stávající formulář poptávky), nebo vouchery jen pro už vypsané termíny?
