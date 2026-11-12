import { sql, ensureSchema } from "./db";

// Klíče e-mailových šablon, které jde upravovat v adminu. Systémové e-maily
// (magic-link přihlášení, uvítací e-mail) záměrně nejsou editovatelné — jsou
// bezpečnostně citlivé, needitujeme je přes formulář.
export type TemplateKey =
  | "admin_new_request_kurz"
  | "admin_new_request_pronajem"
  | "requester_received_kurz"
  | "requester_received_pronajem"
  | "requester_decision_kurz_approved"
  | "requester_decision_kurz_rejected"
  | "requester_decision_pronajem_approved"
  | "requester_decision_pronajem_rejected"
  | "booking_changed"
  | "booking_cancelled"
  | "course_changed"
  | "course_cancelled"
  | "admin_new_signup"
  | "signup_received"
  | "signup_decision_approved"
  | "signup_decision_rejected"
  | "course_paid"
  | "voucher_redeemed"
  | "voucher_buyer"
  | "signup_cancelled"
  | "membership_payment"
  | "membership_access"
  | "membership_request"
  | "membership_sms_admin";

export interface TemplateDef {
  label: string;
  description: string;
  vars: string[];
  subject: string;
  body: string;
}

export interface TemplateForAdmin extends TemplateDef {
  key: TemplateKey;
  defaultSubject: string;
  defaultBody: string;
  customized: boolean;
  updatedAt: string | null;
}

// Výchozí texty — pokud admin nic neupraví, používají se tyhle. Zástupné
// symboly {{promenna}} se při odeslání nahradí skutečnými hodnotami (viz
// renderTemplate). Podpis „Ateliér na pobřeží“ s adresou www.ateliernapobrezi.cz se
// připojuje automaticky při odeslání, není součástí šablony.
export const DEFAULT_TEMPLATES: Record<TemplateKey, TemplateDef> = {
  admin_new_request_kurz: {
    label: "Admin: nová poptávka na kurz",
    description: "Pošle se adminům, když někdo přes web pošle poptávku na skupinový kurz na míru.",
    vars: ["name", "date", "startTime", "endTime", "noteBlock", "contact", "adminUrl"],
    subject: "Nová poptávka na skupinový kurz ({{date}})",
    body: `<p><strong>{{name}}</strong> má zájem o skupinový kurz na míru na <strong>{{date}}</strong> od {{startTime}} do {{endTime}}.</p>
{{noteBlock}}
<p>Kontakt: {{contact}}</p>
<p style="margin-top:16px;"><a href="{{adminUrl}}" style="background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Zobrazit a rozhodnout</a></p>
<p style="color:#888;font-size:13px;">Termín kurzu se v rozpisu zablokuje až po potvrzení.</p>`,
  },
  admin_new_request_pronajem: {
    label: "Admin: nová žádost o pronájem",
    description: "Pošle se adminům, když někdo přes web pošle žádost o pronájem prostoru / rezervaci místa.",
    vars: ["name", "what", "resourceLabel", "date", "startTime", "endTime", "noteBlock", "contact", "adminUrl"],
    subject: "Nová žádost — {{resourceLabel}} ({{date}})",
    body: `<p><strong>{{name}}</strong> žádá o {{what}} na <strong>{{date}}</strong> od {{startTime}} do {{endTime}}.</p>
{{noteBlock}}
<p>Kontakt: {{contact}}</p>
<p style="margin-top:16px;"><a href="{{adminUrl}}" style="background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Zobrazit a rozhodnout</a></p>
<p style="color:#888;font-size:13px;">Termín se v rozpisu zablokuje až po schválení.</p>`,
  },
  requester_received_kurz: {
    label: "Žadatel: poptávka na kurz přijata",
    description: "Potvrzení pro zájemce hned po odeslání poptávky na skupinový kurz.",
    vars: ["name", "date", "startTime", "endTime"],
    subject: "Přijali jsme vaši poptávku na kurz — Ateliér na pobřeží",
    body: `<p>Dobrý den,</p>
<p>vaši poptávku na skupinový kurz na míru na <strong>{{date}}</strong> od {{startTime}} do {{endTime}} jsme přijali. Ozveme se co nejdřív, nejpozději následující pracovní den, s potvrzením nebo návrhem nejbližšího volného termínu.</p>`,
  },
  requester_received_pronajem: {
    label: "Žadatel: žádost o pronájem přijata",
    description: "Potvrzení pro žadatele hned po odeslání žádosti o pronájem / rezervaci místa.",
    vars: ["name", "what", "date", "startTime", "endTime"],
    subject: "Přijali jsme vaši žádost — Ateliér na pobřeží",
    body: `<p>Dobrý den,</p>
<p>vaši {{what}} na <strong>{{date}}</strong> od {{startTime}} do {{endTime}} jsme přijali. Ozveme se co nejdřív, nejpozději následující pracovní den.</p>`,
  },
  requester_decision_kurz_approved: {
    label: "Žadatel: kurz potvrzen",
    description: "Pošle se, když admin schválí poptávku na skupinový kurz.",
    vars: ["name", "date", "startTime", "endTime", "noteBlock"],
    subject: "Kurz potvrzen — {{date}}",
    body: `<p>Dobrý den,</p>
<p>váš skupinový kurz na míru je potvrzený na <strong>{{date}}</strong>, od {{startTime}} do {{endTime}}.</p>
{{noteBlock}}
<p><strong>Kde nás najdete:</strong> <a href="https://mapy.com/cs/zakladni?q=Na%20pob%C5%99e%C5%BE%C3%AD%2067%2C%20Kol%C3%ADn">Ateliér na pobřeží, Na pobřeží 67, Kolín</a> (areál bývalé továrny Kolinea).</p>
<p><strong>Co s sebou:</strong> pohodlné oblečení, které může být od hlíny — materiál a pomůcky zajišťujeme.</p>
<p>Těšíme se na vás.</p>`,
  },
  requester_decision_kurz_rejected: {
    label: "Žadatel: kurz nelze potvrdit",
    description: "Pošle se, když admin zamítne poptávku na skupinový kurz.",
    vars: ["name", "date", "startTime", "endTime", "noteSuffix"],
    subject: "K vaší poptávce na kurz — {{date}}",
    body: `<p>Dobrý den,</p>
<p>termín kurzu na <strong>{{date}}</strong> od {{startTime}} do {{endTime}} vám bohužel nemůžeme potvrdit{{noteSuffix}}.</p>
<p>Napište nám prosím jiný termín, který by vám vyhovoval, a zkusíme ho domluvit.</p>`,
  },
  requester_decision_pronajem_approved: {
    label: "Žadatel: pronájem potvrzen",
    description: "Pošle se, když admin schválí žádost o pronájem / rezervaci místa.",
    vars: ["name", "what", "date", "startTime", "endTime", "noteBlock"],
    subject: "Vaše rezervace je potvrzená — {{date}}",
    body: `<p>Dobrý den,</p><p>vaše žádost o {{what}} na <strong>{{date}}</strong> od {{startTime}} do {{endTime}} je potvrzená.</p>{{noteBlock}}<p>Těšíme se na vás.</p>`,
  },
  requester_decision_pronajem_rejected: {
    label: "Žadatel: pronájem nelze potvrdit",
    description: "Pošle se, když admin zamítne žádost o pronájem / rezervaci místa.",
    vars: ["name", "what", "date", "startTime", "endTime", "noteSuffix"],
    subject: "K vaší žádosti — {{date}}",
    body: `<p>Dobrý den,</p><p>vaši žádost o {{what}} na <strong>{{date}}</strong> od {{startTime}} do {{endTime}} bohužel nemůžeme potvrdit{{noteSuffix}}.</p><p>Pokud vám vyhovuje jiný termín, napište nám znovu.</p>`,
  },
  booking_changed: {
    label: "Rezervista: termín změněn",
    description: "Pošle se, když admin ručně upraví existující rezervaci nebo termín kurzu.",
    vars: ["whatChanged", "beforeLabel", "beforeDate", "beforeStart", "beforeEnd", "afterLabel", "afterDate", "afterStart", "afterEnd"],
    subject: "Změna termínu — {{afterDate}}",
    body: `<p>Dobrý den,</p>
<p>administrátor upravil {{whatChanged}}.</p>
<p><strong>Původně:</strong> {{beforeLabel}}, {{beforeDate}} {{beforeStart}}–{{beforeEnd}}</p>
<p><strong>Nově:</strong> {{afterLabel}}, {{afterDate}} {{afterStart}}–{{afterEnd}}</p>`,
  },
  booking_cancelled: {
    label: "Rezervista: termín zrušen",
    description: "Pošle se, když admin smaže existující rezervaci nebo termín kurzu.",
    vars: ["whatCancelled", "resourceLabel", "date", "startTime", "endTime"],
    subject: "Zrušení termínu — {{date}}",
    body: `<p>Dobrý den,</p>
<p>administrátor zrušil {{whatCancelled}} ({{resourceLabel}}, {{date}} {{startTime}}–{{endTime}}).</p>
<p>Pokud budete chtít nový termín, napište nám.</p>`,
  },
  course_changed: {
    label: "Změna termínu kurzu (účastník)",
    description: "Pošle se přihlášeným na kurz (obdarovanému, jinak kupujícímu), když admin změní čas nebo den termínu kurzu a zaškrtne „Informovat přihlášené“.",
    vars: ["courseTitle", "beforeDate", "beforeStart", "beforeEnd", "afterDate", "afterStart", "afterEnd"],
    subject: "Změna termínu kurzu {{courseTitle}}: {{afterDate}}",
    body: `<p>Dobrý den,</p>
<p>termín vašeho kurzu <strong>{{courseTitle}}</strong> se změnil. Omlouváme se za komplikace.</p>
<p><strong>Původně:</strong> {{beforeDate}}, {{beforeStart}}–{{beforeEnd}}<br><strong>Nově:</strong> {{afterDate}}, {{afterStart}}–{{afterEnd}}</p>
<p>Vaše místo zůstává potvrzené, nemusíte nic dělat. Pokud vám nový termín nevyhovuje, napište nám na <a href="mailto:rezervace@ateliernapobrezi.cz">rezervace@ateliernapobrezi.cz</a> a rádi najdeme jiný.</p>`,
  },
  course_cancelled: {
    label: "Zrušení termínu kurzu (účastník)",
    description: "Pošle se přihlášeným na kurz (obdarovanému, jinak kupujícímu), když admin smaže termín kurzu a zaškrtne „Informovat přihlášené“.",
    vars: ["courseTitle", "date", "startTime", "endTime"],
    subject: "Zrušení termínu kurzu {{courseTitle}}: {{date}}",
    body: `<p>Dobrý den,</p>
<p>termín kurzu <strong>{{courseTitle}}</strong> ({{date}}, {{startTime}}–{{endTime}}) bohužel musíme zrušit. Moc nás to mrzí.</p>
<p>Ozveme se vám s nabídkou náhradního termínu a jako omluvu vám přidáme drobnou pozornost. Pokud vám náhradní termín nevyhovuje, vrátíme vám platbu. Kdybyste nám chtěli napsat dřív, pište na <a href="mailto:rezervace@ateliernapobrezi.cz">rezervace@ateliernapobrezi.cz</a>.</p>`,
  },
  admin_new_signup: {
    label: "Nová přihláška na kurz (admin)",
    description: "Pošle se adminům, když se někdo přihlásí na vypsaný termín kurzu na /kurzy.",
    vars: ["name", "people", "peopleWord", "courseTitle", "date", "startTime", "endTime", "noteBlock", "contact", "adminUrl"],
    subject: "Nová přihláška na kurz — {{courseTitle}} ({{date}})",
    body: `<p><strong>{{name}}</strong> ({{people}} {{peopleWord}}) se přihlásil/a na kurz <strong>{{courseTitle}}</strong>, {{date}} od {{startTime}} do {{endTime}}.</p>
{{noteBlock}}
<p>Kontakt: {{contact}}</p>
<p style="margin-top:16px;"><a href="{{adminUrl}}" style="background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Zobrazit a rozhodnout</a></p>`,
  },
  signup_received: {
    label: "Přihláška přijata (zákazník, termín bez platby)",
    description: "Potvrzení hned po odeslání přihlášky na vypsaný termín kurzu.",
    vars: ["name", "courseTitle", "date", "startTime", "endTime"],
    subject: "Přihláška přijata — {{courseTitle}} ({{date}})",
    body: `<p>Dobrý den,</p>
<p>děkujeme za přihlášku na kurz <strong>{{courseTitle}}</strong>, {{date}} od {{startTime}} do {{endTime}}.</p>
<p>Ozveme se vám co nejdřív s potvrzením místa.</p>`,
  },
  signup_decision_approved: {
    label: "Vaše místo na kurzu je potvrzené (zákazník, schváleno adminem)",
    description: "Pošle se, když admin schválí přihlášku na vypsaný termín kurzu.",
    vars: ["name", "courseTitle", "date", "startTime", "endTime"],
    subject: "Vaše místo na kurzu je potvrzené — {{date}}",
    body: `<p>Dobrý den,</p><p>vaše místo na kurzu <strong>{{courseTitle}}</strong> ({{date}} {{startTime}}–{{endTime}}) je potvrzené. Těšíme se na vás.</p>`,
  },
  course_paid: {
    label: "Potvrzeno: kurz zaplacen 🎉 (zákazník po platbě)",
    description: "Jediný e-mail zákazníkovi po zaplacení kurzu kartou: potvrzení místa a platby, kdy a kde, tlačítko do kalendáře. Pod podpisem se vždy připojí věta o obchodních podmínkách (není v šabloně).",
    vars: ["courseTitle", "weekday", "date", "startTime", "endTime", "amount", "people", "castingNote", "calendarUrl"],
    subject: "Potvrzeno: {{courseTitle}}, {{date}}, zaplaceno {{amount}} 🎉",
    body: `<p>Dobrý den,</p>
<p>děkujeme, Vaše místo na kurzu <strong>{{courseTitle}}</strong> je potvrzené a platba proběhla.</p>
<p><strong>Kdy:</strong> {{weekday}} {{date}}, {{startTime}}–{{endTime}}<br>
<strong>Kde:</strong> <a href="https://mapy.com/cs/zakladni?q=Na%20pob%C5%99e%C5%BE%C3%AD%2067%2C%20Kol%C3%ADn">Ateliér na pobřeží, Na pobřeží 67, Kolín</a> (5 minut pěšky od nádraží)<br>
<strong>Zaplaceno:</strong> {{amount}}, {{people}}{{castingNote}}<br>
<strong>V ceně:</strong> materiál, vybavení, vedení lektorem a občerstvení</p>
<p style="margin:18px 0;"><a href="{{calendarUrl}}" style="background:#111;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Přidat do kalendáře</a></p>
<p>Potvrzení o platbě Vám zasílá platební brána Stripe samostatně. Chcete-li kurz objednat na firmu, ozvěte se nám a vyřešíme to.</p>
<p>Podrobné informace k samotnému kurzu včetně mapy Vám pošleme na tento e-mail včas před jeho konáním.</p>
<p>Těšíme se na Vás.</p>`,
  },
  voucher_redeemed: {
    label: "Potvrzeno: poukaz uplatněn 🎉 (obdarovaný po uplatnění)",
    description: "Pošle se tomu, kdo na /kurzy uplatnil dárkový poukaz a vybral termín: místo je potvrzené hned, bez platby.",
    vars: ["courseTitle", "weekday", "date", "startTime", "endTime", "code", "people", "castingNote", "calendarUrl"],
    subject: "Potvrzeno: {{courseTitle}}, {{date}}, uplatněn poukaz 🎉",
    body: `<p>Dobrý den,</p>
<p>poukaz <strong>{{code}}</strong> je uplatněný a Vaše místo na kurzu <strong>{{courseTitle}}</strong> je potvrzené.</p>
<p><strong>Kdy:</strong> {{weekday}} {{date}}, {{startTime}}–{{endTime}}<br>
<strong>Kde:</strong> <a href="https://mapy.com/cs/zakladni?q=Na%20pob%C5%99e%C5%BE%C3%AD%2067%2C%20Kol%C3%ADn">Ateliér na pobřeží, Na pobřeží 67, Kolín</a> (5 minut pěšky od nádraží)<br>
<strong>Počet osob:</strong> {{people}}{{castingNote}}<br>
<strong>V ceně:</strong> materiál, vybavení, vedení lektorem a občerstvení</p>
<p style="margin:18px 0;"><a href="{{calendarUrl}}" style="background:#111;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Přidat do kalendáře</a></p>
<p>Při příchodu stačí zmínit kód poukazu. S sebou si vezměte pohodlné oblečení, které může být od hlíny, materiál a pomůcky zajišťujeme.</p>
<p>Podrobné informace k samotnému kurzu Vám pošleme na tento e-mail včas před jeho konáním.</p>
<p>Těšíme se na Vás.</p>`,
  },
  voucher_buyer: {
    label: "Váš dárkový poukaz (kupující po zaplacení)",
    description: "Pošle se kupujícímu hned po zaplacení poukazu: kód, shrnutí a jak poukaz uplatnit. Bloky {{summaryBlock}}, {{messageBlock}} a {{redeemBlock}} se skládají automaticky (termín/tlačítko/kontakt podle toho, jestli je u poukazu vybraný termín), jejich text se mění v kódu, ne tady.",
    vars: ["amount", "code", "summaryBlock", "messageBlock", "redeemBlock"],
    subject: "Váš dárkový poukaz {{code}} 🎉",
    body: `<p>Dobrý den,</p>
<p>děkujeme za objednávku, platba proběhla v pořádku. Váš dárkový poukaz v hodnotě <strong>{{amount}}</strong>:</p>
<p style="margin:16px 0 4px;color:#666;font-size:13px;">Kód poukazu</p>
<p style="display:inline-block;margin:0 0 16px;padding:12px 20px;border:2px solid #111;border-radius:8px;font-size:22px;letter-spacing:2px;"><strong>{{code}}</strong></p>
{{summaryBlock}}
{{messageBlock}}
{{redeemBlock}}
<p>Obdarovanému stačí předat jen kód poukazu. Pozor: pokud mu přepošlete celý tento e-mail, dozví se i cenu poukazu.</p>
<p>Těšíme se na Vás.</p>`,
  },
  signup_cancelled: {
    label: "Storno přihlášky na kurz (zákazník)",
    description: "Pošle se, když admin stornuje přihlášku na kurz. Blok {{refundBlock}} se přidá jen při vratce peněz.",
    vars: ["courseTitle", "date", "startTime", "endTime", "refundBlock"],
    subject: "Storno přihlášky na kurz",
    body: `<p>Dobrý den,</p>
<p>Vaše přihláška na kurz <strong>{{courseTitle}}</strong> ({{date}}, {{startTime}}–{{endTime}}) byla stornována.</p>
{{refundBlock}}
<p>V případě dotazů nám napište odpovědí na tento e-mail.</p>`,
  },
  membership_payment: {
    label: "Vaše žádost o členství je schválená (člen, odkaz na platbu)",
    description: "Pošle se členovi po schválení žádosti nebo po ručním přidání placeného člena: odkaz na zaplacení prvního měsíce přes Stripe. Tykání členům.",
    vars: ["name", "payLink"],
    subject: "Vaše žádost o členství je schválená",
    body: `<p>Ahoj {{name}}!</p>
<p>Vítej v Klubu na pobřeží. Díky, že do toho jdeš.</p>
<p>Kartou zaplatíš přes online platební bránu Stripe. Potom ti přijde potvrzení a odkaz na rezervaci místa v Klubu na pobřeží. S každou další měsíční platbou ti přijde e-mailem potvrzení. Pokud potřebuješ daňový doklad, napiš Milanovi. Členství můžeš kdykoliv zrušit v rezervačním systému.</p>
<p style="margin-top:20px;"><a href="{{payLink}}" style="background:#111;color:#fff;border:2px solid #111;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Zaplatit členství</a></p>
<p style="color:#888;font-size:13px;margin-top:10px;">Tenhle odkaz na platbu platí 30 dní.</p>`,
  },
  membership_access: {
    label: "Vítejte v Klubu na pobřeží 🎉 (člen po první platbě)",
    description: "Pošle se členovi po první zaplacené platbě (a hned po přidání člena zdarma): přístup do ateliéru a tlačítko do rezervací. Kódy ke schránce s klíči sem nepatří, posílá je Milan v SMS.",
    vars: ["loginLink", "appUrl"],
    subject: "Vítejte v Klubu na pobřeží 🎉",
    body: `<p>Vítejte, přátelé, v Klubu na pobřeží. Díky, že do toho jdete. Krom jiného jste získali přístup do Ateliéru na pobřeží, kde si můžete <a href="{{appUrl}}" style="color:#111;text-decoration:underline;">zarezervovat</a> místo nebo aktivitu, kdykoliv je v kalendáři volno.</p>
<p>Do ateliéru se dostanete z ulice Na pobřeží, od kolejí. Na dveřích je poštovní schránka a v ní schránka s klíči. Kódy k ní vám pošleme v SMS.</p>
<p style="margin-top:20px;"><a href="{{loginLink}}" style="background:#fff;color:#111;border:2px solid #111;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Zaber si flek</a></p>
<p style="color:#888;font-size:13px;margin-top:10px;">Tlačítko vás rovnou přihlásí do rezervací. Odkaz platí 7 dní. Potom se stačí přihlásit zadáním e-mailu na rezervace.ateliernapobrezi.cz.</p>`,
  },
  membership_request: {
    label: "Nová žádost o členství (admin)",
    description: "Pošle se adminům, když někdo vyplní „Chci do klubu“ na /clenstvi. Blok {{messageBlock}} (vzkaz žadatele) se skládá automaticky.",
    vars: ["name", "email", "phoneLine", "messageBlock", "adminUrl"],
    subject: "Nová žádost o členství: {{name}}",
    body: `<p><strong>Nová žádost o členství v klubu</strong></p>
<p>Jméno: {{name}}<br>E-mail: {{email}}{{phoneLine}}</p>
{{messageBlock}}
<p style="margin-top:20px;"><a href="{{adminUrl}}" style="background:#111;color:#fff;border:2px solid #111;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Otevřít a schválit</a></p>
<p style="color:#888;font-size:13px;margin-top:10px;">V administraci otevřete Účty, nahoře uvidíte žádosti ke schválení.</p>`,
  },
  membership_sms_admin: {
    label: "Pošlete SMS s kódy ke schránce (admin, nový člen)",
    description: "Pošle se adminům ve chvíli, kdy novému členovi odejde uvítací e-mail s přístupem (po první platbě nebo po přidání člena zdarma). Připomíná poslat členovi SMS s kódy ke schránce s klíči; kódy sem nepatří. Telefon se bere ze žádosti o členství, pokud ho člen vyplnil.",
    vars: ["name", "email", "phoneLine"],
    subject: "Pošlete SMS s kódy ke schránce: {{name}}",
    body: `<p>Nový člen klubu má přístup do rezervací a čeká na kódy ke schránce s klíči.</p>
<p><strong>Jméno:</strong> {{name}}<br><strong>E-mail:</strong> {{email}}{{phoneLine}}</p>
<p><strong>Co udělat:</strong> pošlete mu SMS s kódy ke schránce s klíči (poštovní schránka na dveřích ateliéru).</p>`,
  },
  signup_decision_rejected: {
    label: "K vaší přihlášce na kurz (zákazník, nelze potvrdit)",
    description: "Pošle se, když admin zamítne přihlášku na vypsaný termín kurzu (např. plná kapacita).",
    vars: ["name", "courseTitle", "date", "startTime", "endTime"],
    subject: "K vaší přihlášce na kurz — {{date}}",
    body: `<p>Dobrý den,</p><p>na kurz <strong>{{courseTitle}}</strong> ({{date}} {{startTime}}–{{endTime}}) vás bohužel nemůžeme zapsat — kapacita je bohužel plná. Ozveme se s dalším možným termínem.</p>`,
  },
};

// Nahradí {{promenna}} v textu skutečnou hodnotou. Neznámé/chybějící
// proměnné se nahradí prázdným řetězcem, ať šablona nikdy nespadne.
export function renderTemplate(str: string, vars: Record<string, string>): string {
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

export async function getTemplate(key: TemplateKey): Promise<TemplateDef> {
  const def = DEFAULT_TEMPLATES[key];
  try {
    await ensureSchema();
    const rows = await sql`SELECT subject, body FROM email_templates WHERE key = ${key}`;
    if (rows[0]) {
      return { ...def, subject: rows[0].subject as string, body: rows[0].body as string };
    }
  } catch (err) {
    console.error(`[emailTemplates] Načtení šablony ${key} selhalo, používám výchozí text:`, err);
  }
  return def;
}

export async function getAllTemplatesForAdmin(): Promise<TemplateForAdmin[]> {
  await ensureSchema();
  const rows = await sql`SELECT key, subject, body, updated_at FROM email_templates`;
  const overrides = new Map(rows.map((r) => [r.key as string, r]));
  return (Object.keys(DEFAULT_TEMPLATES) as TemplateKey[]).map((key) => {
    const def = DEFAULT_TEMPLATES[key];
    const override = overrides.get(key);
    const updated = override?.updated_at as string | Date | undefined;
    return {
      key,
      ...def,
      subject: (override?.subject as string) ?? def.subject,
      body: (override?.body as string) ?? def.body,
      defaultSubject: def.subject,
      defaultBody: def.body,
      customized: !!override,
      updatedAt: updated ? (typeof updated === "string" ? updated : updated.toISOString()) : null,
    };
  });
}

export async function saveTemplateOverride(key: TemplateKey, subject: string, body: string): Promise<void> {
  await ensureSchema();
  await sql`
    INSERT INTO email_templates (key, subject, body, updated_at)
    VALUES (${key}, ${subject}, ${body}, now())
    ON CONFLICT (key) DO UPDATE SET subject = ${subject}, body = ${body}, updated_at = now()
  `;
}

export async function resetTemplateOverride(key: TemplateKey): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM email_templates WHERE key = ${key}`;
}
