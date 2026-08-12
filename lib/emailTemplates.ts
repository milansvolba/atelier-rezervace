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
  | "admin_new_signup"
  | "signup_received"
  | "signup_decision_approved"
  | "signup_decision_rejected";

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
// renderTemplate). Patička s "Atelier na Pobřeží · rezervace..." se
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
    subject: "Přijali jsme vaši poptávku na kurz — Atelier na Pobřeží",
    body: `<p>Dobrý den {{name}},</p>
<p>vaši poptávku na skupinový kurz na míru na <strong>{{date}}</strong> od {{startTime}} do {{endTime}} jsme přijali. Ozveme se co nejdřív, nejpozději následující pracovní den, s potvrzením nebo návrhem nejbližšího volného termínu.</p>`,
  },
  requester_received_pronajem: {
    label: "Žadatel: žádost o pronájem přijata",
    description: "Potvrzení pro žadatele hned po odeslání žádosti o pronájem / rezervaci místa.",
    vars: ["name", "what", "date", "startTime", "endTime"],
    subject: "Přijali jsme vaši žádost — Atelier na Pobřeží",
    body: `<p>Dobrý den {{name}},</p>
<p>vaši {{what}} na <strong>{{date}}</strong> od {{startTime}} do {{endTime}} jsme přijali. Ozveme se co nejdřív, nejpozději následující pracovní den.</p>`,
  },
  requester_decision_kurz_approved: {
    label: "Žadatel: kurz potvrzen",
    description: "Pošle se, když admin schválí poptávku na skupinový kurz.",
    vars: ["name", "date", "startTime", "endTime", "noteBlock"],
    subject: "Kurz potvrzen — {{date}}",
    body: `<p>Dobrý den {{name}},</p>
<p>váš skupinový kurz na míru je potvrzený na <strong>{{date}}</strong>, od {{startTime}} do {{endTime}}.</p>
{{noteBlock}}
<p><strong>Kde nás najdete:</strong> Ateliér na pobřeží, Na pobřeží 67, Kolín (areál bývalé továrny Kolinea).</p>
<p><strong>Co s sebou:</strong> pohodlné oblečení, které může být od hlíny — materiál a pomůcky zajišťujeme.</p>
<p>Těšíme se na vás.</p>`,
  },
  requester_decision_kurz_rejected: {
    label: "Žadatel: kurz nelze potvrdit",
    description: "Pošle se, když admin zamítne poptávku na skupinový kurz.",
    vars: ["name", "date", "startTime", "endTime", "noteSuffix"],
    subject: "K vaší poptávce na kurz — {{date}}",
    body: `<p>Dobrý den {{name}},</p>
<p>termín kurzu na <strong>{{date}}</strong> od {{startTime}} do {{endTime}} vám bohužel nemůžeme potvrdit{{noteSuffix}}.</p>
<p>Napište nám prosím jiný termín, který by vám vyhovoval, a zkusíme ho domluvit.</p>`,
  },
  requester_decision_pronajem_approved: {
    label: "Žadatel: pronájem potvrzen",
    description: "Pošle se, když admin schválí žádost o pronájem / rezervaci místa.",
    vars: ["name", "what", "date", "startTime", "endTime", "noteBlock"],
    subject: "Vaše rezervace je potvrzená — {{date}}",
    body: `<p>Dobrý den {{name}},</p><p>vaše žádost o {{what}} na <strong>{{date}}</strong> od {{startTime}} do {{endTime}} je potvrzená.</p>{{noteBlock}}<p>Těšíme se na vás.</p>`,
  },
  requester_decision_pronajem_rejected: {
    label: "Žadatel: pronájem nelze potvrdit",
    description: "Pošle se, když admin zamítne žádost o pronájem / rezervaci místa.",
    vars: ["name", "what", "date", "startTime", "endTime", "noteSuffix"],
    subject: "K vaší žádosti — {{date}}",
    body: `<p>Dobrý den {{name}},</p><p>vaši žádost o {{what}} na <strong>{{date}}</strong> od {{startTime}} do {{endTime}} bohužel nemůžeme potvrdit{{noteSuffix}}.</p><p>Pokud vám vyhovuje jiný termín, napište nám znovu.</p>`,
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
  admin_new_signup: {
    label: "Admin: nová přihláška na kurz",
    description: "Pošle se adminům, když se někdo přihlásí na vypsaný termín kurzu na /kurzy.",
    vars: ["name", "people", "peopleWord", "courseTitle", "date", "startTime", "endTime", "noteBlock", "contact", "adminUrl"],
    subject: "Nová přihláška na kurz — {{courseTitle}} ({{date}})",
    body: `<p><strong>{{name}}</strong> ({{people}} {{peopleWord}}) se přihlásil/a na kurz <strong>{{courseTitle}}</strong>, {{date}} od {{startTime}} do {{endTime}}.</p>
{{noteBlock}}
<p>Kontakt: {{contact}}</p>
<p style="margin-top:16px;"><a href="{{adminUrl}}" style="background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Zobrazit a rozhodnout</a></p>`,
  },
  signup_received: {
    label: "Přihlášený: přihláška přijata",
    description: "Potvrzení hned po odeslání přihlášky na vypsaný termín kurzu.",
    vars: ["name", "courseTitle", "date", "startTime", "endTime"],
    subject: "Přihláška přijata — {{courseTitle}} ({{date}})",
    body: `<p>Dobrý den {{name}},</p>
<p>děkujeme za přihlášku na kurz <strong>{{courseTitle}}</strong>, {{date}} od {{startTime}} do {{endTime}}.</p>
<p>Ozveme se vám co nejdřív s potvrzením místa.</p>`,
  },
  signup_decision_approved: {
    label: "Přihlášený: místo potvrzeno",
    description: "Pošle se, když admin schválí přihlášku na vypsaný termín kurzu.",
    vars: ["name", "courseTitle", "date", "startTime", "endTime"],
    subject: "Vaše místo na kurzu je potvrzené — {{date}}",
    body: `<p>Dobrý den {{name}},</p><p>vaše místo na kurzu <strong>{{courseTitle}}</strong> ({{date}} {{startTime}}–{{endTime}}) je potvrzené. Těšíme se na vás.</p>`,
  },
  signup_decision_rejected: {
    label: "Přihlášený: místo nelze potvrdit",
    description: "Pošle se, když admin zamítne přihlášku na vypsaný termín kurzu (např. plná kapacita).",
    vars: ["name", "courseTitle", "date", "startTime", "endTime"],
    subject: "K vaší přihlášce na kurz — {{date}}",
    body: `<p>Dobrý den {{name}},</p><p>na kurz <strong>{{courseTitle}}</strong> ({{date}} {{startTime}}–{{endTime}}) vás bohužel nemůžeme zapsat — kapacita je bohužel plná. Ozveme se s dalším možným termínem.</p>`,
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
