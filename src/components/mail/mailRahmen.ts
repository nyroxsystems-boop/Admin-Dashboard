/**
 * Partsunion-Rahmen für E-Mail-Darstellung.
 *
 * Umsetzung der Vorlage `partsunion-mail-vorlage.html`. Bewusst als getippte
 * Funktion und nicht als Handlebars-Vorlage:
 *
 *   • Der Compiler prüft mit, ob jedes Feld gefüllt wird. Eine Vorlage mit
 *     `{{absender_name}}` schweigt, wenn das Feld fehlt — und in der Mail
 *     steht dann nichts oder wörtlich die Klammer.
 *   • Das MASKIEREN lässt sich nicht vergessen. Betreff und Absendername
 *     kommen von Fremden; `Max <script>alert(1)</script>` im Anzeigenamen ist
 *     kein theoretischer Fall. Hier geht jeder Wert durch esc(), und nur
 *     `inhaltHtml` wird roh eingesetzt — das ist bereits bereinigt.
 *
 * Die HTML-Struktur entspricht der Vorlage: Tabellen, Inline-Stile,
 * mso-Anweisungen. Das sieht altbacken aus und ist es auch — aber E-Mail-
 * Programme können nichts anderes zuverlässig. Wer hier auf Flexbox umstellt,
 * bekommt in Outlook eine Bleiwüste.
 */

/** Farben der Kategoriestreifen, aus der Vorlage übernommen. */
export const KATEGORIE = {
    kunde: '#1B6FE3',
    eskalation: '#C0342E',
    erfolg: '#0E9F6E',
    wartet: '#B4740E',
    info: '#8592A6',
} as const;

export type KategorieFarbe = (typeof KATEGORIE)[keyof typeof KATEGORIE];

/** Gedaempfte Schrift im Rahmen — fuer Hinweise ohne eigenen Inhalt. */
export const RAHMEN_GEDAEMPFT = '#7A879B';

/**
 * Farben des Rahmens im dunklen Erscheinungsbild.
 *
 * Entspricht den Tokens der Anwendung (tokens.css) — der Rahmen soll aussehen
 * wie ein Teil des Dashboards, nicht wie ein eingelegter Brief. Als feste Werte,
 * weil dieses HTML auch in E-Mail-Programmen landen kann, die keine
 * CSS-Variablen kennen.
 */
export const DUNKEL = {
    karte: '#111418',
    aussen: '#0B0C0E',
    rand: '#252A31',
    randZart: '#1E242C',
    text: '#E9EDF1',
    textLeise: '#9AA3AC',
    chip: '#1A1E23',
    leiste: '#0B0C0E',
} as const;

/** Untergrund der Kontextmarken. Exportiert, damit Tests darauf pruefen koennen. */
export const RAHMEN_CHIP_HINTERGRUND = '#F1F5FA';

/** Heller Untergrund der Markenleiste im Light Mode. */
export const RAHMEN_MARKENLEISTE = '#FFFFFF';

export interface Anhang {
    dateiname: string;
    groesse: string;
}

export interface Aktion {
    text: string;
    url: string;
}

export interface MailRahmenDaten {
    betreff: string;
    /** Erscheint in der Vorschau neben der Betreffzeile, ~85 Zeichen. */
    vorschautext: string;
    kategorieLabel: string;
    kategorieFarbe: string;
    absenderName: string;
    absenderAdresse: string;
    absenderInitialen: string;
    empfangenAm: string;
    /** Kleine Kontextmarken unter dem Betreff. Leer = keine Zeile. */
    chips: string[];
    /** BEREITS BEREINIGT. Einziger Wert, der roh eingesetzt wird. */
    inhaltHtml: string;
    hervorhebung?: string | null;
    anhaenge: Anhang[];
    aktionPrimaer?: Aktion | null;
    aktionSekundaer?: Aktion | null;
    /**
     * Dunkle Markenleiste mit dem PARTSUNION-Schriftzug zeigen?
     *
     * Bei Post von aussen: ja — sie macht aus einer fremden Mail eine, die zu
     * uns gehoert. Bei unseren EIGENEN Benachrichtigungen: nein. Die bringen
     * ihren eigenen dunklen Kopfbereich mit Logo schon mit, und zwei
     * Partsunion-Balken untereinander sehen nach Versehen aus.
     *
     * Ohne Leiste tritt eine schlanke Zeile an ihre Stelle: die Kategorie geht
     * so nicht verloren.
     */
    zeigeMarkenleiste: boolean;
    /**
     * Untergrund AUSSERHALB der Karte.
     *
     * In einer echten E-Mail ist das ein helles Grau — so kennt man es aus
     * jedem Postfach. Beim Lesen im Dashboard stoert dieser Streifen: er legt
     * einen hellen Rahmen um die Karte, mitten in einer dunklen Oberflaeche.
     * `null` macht ihn durchsichtig, dann sitzt die Karte direkt auf der
     * Arbeitsflaeche der Anwendung.
     */
    aussenHintergrund?: string | null;
    /**
     * Dunkles Erscheinungsbild.
     *
     * Beim Lesen im Dashboard: ja — eine weisse Karte in einer dunklen
     * Anwendung sticht heraus wie ein Fremdkoerper. Beim VERSENDEN: nein, dort
     * gilt das helle Original; wir wissen nicht, welches Erscheinungsbild der
     * Empfaenger nutzt.
     */
    dunkel?: boolean;
    /**
     * Volle Breite statt Briefformat.
     *
     * 600 px sind das Mass einer echten E-Mail. Im Lesebereich des Dashboards
     * bleibt daneben viel Leerraum — dort ist die volle Breite richtig.
     */
    volleBreite?: boolean;
    fusszeileHerkunft: string;
    /**
     * Anschrift im Fuß. `null` lässt die Zeile weg — besser als die
     * Platzhalteradresse aus der Vorlage ("Musterstraße 1") auszuliefern.
     */
    firmenzeile?: string | null;
    abmeldeUrl?: string | null;
}

/** Maskiert einen Wert für den HTML-Textfluss und für Attributwerte. */
function esc(wert: string): string {
    return wert
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Maskiert eine Adresse für ein href.
 *
 * Zusätzlich zum Maskieren wird das Schema geprüft: `javascript:` in einem
 * href würde sonst durchgehen. Unbrauchbare Adressen werden zu '#', statt die
 * ganze Mail wegen einer kaputten Verknüpfung zu verwerfen.
 */
function escUrl(url: string): string {
    const erlaubt = /^(https?:|mailto:|tel:)/i;
    return erlaubt.test(url.trim()) ? esc(url.trim()) : '#';
}

const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO = "'Courier New', Courier, monospace";

/** Unsichtbare Füllzeichen, damit der Vorschautext nicht vom Inhalt fortgesetzt wird. */
const VORSCHAU_FUELLER = '&nbsp;&#847;&zwnj;'.repeat(12);

/** Heller Untergrund einer echten E-Mail. Beim Lesen im Dashboard: durchsichtig. */
export const RAHMEN_AUSSEN = '#EEF1F5';

export function renderMailRahmen(d: MailRahmenDaten): string {
    const dunkel = d.dunkel === true;
    const aussen = d.aussenHintergrund === undefined
        ? (dunkel ? DUNKEL.aussen : RAHMEN_AUSSEN)
        : d.aussenHintergrund;
    const aussenStil = aussen ? `background: ${aussen};` : 'background: transparent;';
    // Ohne Untergrund braucht es auch keinen Abstand darum — den gibt die
    // Anwendung vor.
    const aussenAbstand = aussen ? '28px 12px' : '0';

    // Farbwerte je nach Erscheinungsbild. Ein Satz Variablen statt Dutzender
    // Verzweigungen im HTML darunter.
    const F = dunkel ? {
        karte: DUNKEL.karte, rand: DUNKEL.rand, randZart: DUNKEL.randZart,
        titel: DUNKEL.text, text: DUNKEL.text, leise: DUNKEL.textLeise,
        chip: DUNKEL.chip, chipText: DUNKEL.textLeise,
        leiste: DUNKEL.leiste, leisteText: DUNKEL.text, leisteLeise: DUNKEL.textLeise,
        schlankeLeiste: DUNKEL.karte, avatar: DUNKEL.chip, avatarText: DUNKEL.text,
        hervor: DUNKEL.chip, hervorRand: DUNKEL.rand, hervorText: DUNKEL.textLeise,
    } : {
        karte: '#FFFFFF', rand: '#D7DEE8', randZart: '#E5EAF1',
        titel: '#0F172A', text: '#2A3441', leise: '#7A879B',
        chip: RAHMEN_CHIP_HINTERGRUND, chipText: '#4A5C75',
        leiste: RAHMEN_MARKENLEISTE, leisteText: '#0F172A', leisteLeise: '#64748B',
        schlankeLeiste: '#F6F8FB', avatar: '#E7EDF6', avatarText: '#34567F',
        hervor: '#F8FAFC', hervorRand: '#CBD5E1', hervorText: '#46536A',
    };

    /**
     * ─── Leseansicht ohne Deckel, ausgehende Post bei 600 px ──────────────
     *
     * `volleBreite` gilt NUR in der Leseansicht (MailHtmlFrame) — ausgehende
     * Post behaelt die 600 px, die jedes Mailprogramm erwartet.
     *
     * Hier stand erst `100%`, dann 720 px, jetzt wieder die volle Breite. Die
     * Begruendung fuer den Deckel war zu ihrer Zeit richtig und ist es heute
     * nicht mehr — das ist der Grund, warum sie hier stehen bleibt:
     *
     *   Fremde Newsletter sind fuer etwa 600 px gebaut. Ihre inneren Tabellen
     *   tragen `margin: 0 auto` und zentrierten sich frueher EINZELN im viel
     *   zu breiten Rahmen — ein Block bei 394 px, der naechste bei 480, ein
     *   dritter linksbuendig. Das sah nicht breit aus, sondern kaputt. Der
     *   Deckel war die Notbremse dagegen.
     *
     * Inzwischen zwingt der Stilblock JEDE Tabelle im Inhalt auf
     * `margin-left/right: auto` (siehe die Regeln bei .pu-inhalt). Damit
     * sitzen alle Bloecke auf derselben Mittelachse, egal wie breit die Karte
     * ist — nachgemessen an der Instagram-Mail: 17 von 17 Bloecken mit
     * gleichem Rand links und rechts. Die Ursache ist also behoben, und der
     * Deckel ist nur noch eine Kante, die nicht zum Antwortfeld darunter passt.
     *
     * Die Karte fuellt deshalb den Lesebereich und schliesst buendig mit dem
     * Knopf "Auf diese E-Mail antworten" ab, der `w-full` ist.
     */
    /**
     * ─── Warum die Deckelung auf einem DIV sitzt und nicht auf der Tabelle ──
     *
     * Hier stand `max-width: 720px` direkt am <table class="pu-shell">. In
     * Chromium wirkt das: nachgemessen 720 px, mittig, kein Ueberstand. In
     * SAFARI nicht — dort ignoriert eine Tabelle mit `width: 100%` ihre
     * eigene `max-width`, und die Karte lief auf volle Breite. Genau deshalb
     * kam der Fehler dreimal zurueck, obwohl meine Messung jedes Mal 720 ergab:
     * ich habe im falschen Browser gemessen.
     *
     * `max-width` auf einem BLOCK ist dagegen ueberall verlaesslich. Die
     * Tabelle bleibt bei 100 % und fuellt den gedeckelten Block; die Breite
     * bestimmt jetzt die Huelle darum.
     *
     * `margin: 0 auto` steht mit am Block — ein `align="center"` an der
     * Elternzelle allein zentriert einen Block nicht.
     */
    const deckel = d.volleBreite ? '100%' : '600px';
    const breite = 'width: 100%; max-width: 100%;';
    const breiteAttr = '100%';
    // Volle Markenleiste fuer fremde Post; bei eigener nur eine schlanke Zeile
    // mit der Kategorie, damit der Schriftzug nicht doppelt erscheint.
    const kopfleiste = d.zeigeMarkenleiste ? `<tr>
          <td bgcolor="${F.leiste}" class="pu-pad" style="background: ${F.leiste}; padding: 15px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width: 100%;">
              <tr>
                <td align="left" style="font-family: ${SANS}; font-size: 14px; font-weight: 700; letter-spacing: 0.18em; color: ${F.leisteText}; mso-line-height-rule: exactly; line-height: 20px;">PARTSUNION</td>
                <td align="right" style="font-family: ${MONO}; font-size: 11px; letter-spacing: 0.1em; color: ${F.leisteLeise}; mso-line-height-rule: exactly; line-height: 20px;">${esc(d.kategorieLabel)}</td>
              </tr>
            </table>
          </td>
        </tr>` : `<tr>
          <td bgcolor="${F.schlankeLeiste}" class="pu-pad" style="background: ${F.schlankeLeiste}; padding: 9px 24px; font-family: ${MONO}; font-size: 11px; letter-spacing: 0.1em; color: ${F.leise}; mso-line-height-rule: exactly; line-height: 16px;">${esc(d.kategorieLabel)}</td>
        </tr>`;

    const chips = d.chips.length === 0 ? '' : `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 4px;">
              <tr>
                ${d.chips.map((c) => `<td bgcolor="${F.chip}" style="background: ${F.chip}; padding: 5px 9px; font-family: ${MONO}; font-size: 11px; color: ${F.chipText}; mso-line-height-rule: exactly; line-height: 16px;">${esc(c)}</td>
                <td width="6" style="width: 6px;">&nbsp;</td>`).join('\n                ')}
              </tr>
            </table>`;

    const hervorhebung = !d.hervorhebung ? '' : `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width: 100%; margin: 14px 0 0;">
              <tr>
                <td style="padding: 12px 16px; background: ${F.hervor}; border-left: 3px solid ${F.hervorRand}; font-family: ${SANS}; font-size: 14px; line-height: 22px; mso-line-height-rule: exactly; color: ${F.hervorText};">${esc(d.hervorhebung)}</td>
              </tr>
            </table>`;

    const anhaenge = d.anhaenge.length === 0 ? '' : `
        <tr>
          <td class="pu-pad" style="padding: 22px 24px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width: 100%; border: 1px solid ${F.randZart};">
              <tr>
                <td style="padding: 10px 14px; border-bottom: 1px solid ${F.randZart}; font-family: ${MONO}; font-size: 10px; letter-spacing: 0.12em; color: ${F.leise}; mso-line-height-rule: exactly; line-height: 14px;">ANH&Auml;NGE &middot; ${d.anhaenge.length}</td>
              </tr>
              ${d.anhaenge.map((a) => `<tr>
                <td style="padding: 11px 14px; border-bottom: 1px solid ${F.randZart};">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width: 100%;">
                    <tr>
                      <td style="font-family: ${SANS}; font-size: 13px; font-weight: 600; color: ${F.titel}; mso-line-height-rule: exactly; line-height: 18px;">${esc(a.dateiname)}</td>
                      <td align="right" style="font-family: ${MONO}; font-size: 12px; color: ${F.leise}; mso-line-height-rule: exactly; line-height: 18px;">${esc(a.groesse)}</td>
                    </tr>
                  </table>
                </td>
              </tr>`).join('\n              ')}
            </table>
          </td>
        </tr>`;

    // Die Aktionsleiste entfällt ganz, wenn keine Aktion angegeben ist. In der
    // Vorlage ist nur die SEKUNDÄRE Schaltfläche bedingt — beim Lesen im
    // Dashboard gibt es aber gar keine: Antworten und Archivieren stehen in
    // der Werkzeugleiste der Anwendung, und ein Link im abgeschotteten Rahmen
    // könnte sie ohnehin nicht auslösen.
    const aktionen = !d.aktionPrimaer ? '' : `
        <tr>
          <td class="pu-pad" style="padding: 20px 24px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td bgcolor="#1B6FE3" class="pu-btn pu-btn-cell" style="background: #1B6FE3; padding: 13px 22px;">
                  <a href="${escUrl(d.aktionPrimaer.url)}" style="font-family: ${SANS}; font-size: 14px; font-weight: 700; color: #FFFFFF; text-decoration: none; display: block; mso-line-height-rule: exactly; line-height: 18px;">${esc(d.aktionPrimaer.text)}</a>
                </td>
                ${!d.aktionSekundaer ? '' : `<td width="10" class="pu-btn-gap" style="width: 10px;">&nbsp;</td>
                <td class="pu-btn pu-btn-cell" style="padding: 13px 22px; border: 1px solid #CBD5E1;">
                  <a href="${escUrl(d.aktionSekundaer.url)}" style="font-family: ${SANS}; font-size: 14px; font-weight: 600; color: #334155; text-decoration: none; display: block; mso-line-height-rule: exactly; line-height: 18px;">${esc(d.aktionSekundaer.text)}</a>
                </td>`}
              </tr>
            </table>
          </td>
        </tr>`;

    const firmenzeile = !d.firmenzeile ? '' :
        `\n                  <span style="display: block; margin-top: 6px; color: #A9B4C4;">${esc(d.firmenzeile)}</span>`;

    const abmelden = !d.abmeldeUrl ? '' :
        `\n                  <span style="display: block; margin-top: 6px;"><a href="${escUrl(d.abmeldeUrl)}" style="color: #8592A6; text-decoration: underline;">Benachrichtigungen abbestellen</a></span>`;

    return `<!DOCTYPE html>
<html lang="de" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(d.betreff)}</title>
<!--[if mso]>
<xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
<![endif]-->
<style>
  /* Nur was nicht inline gehen kann. Die Mail liest sich auch ohne diesen Block korrekt. */
  @media only screen and (max-width: 620px) {
    .pu-shell { width: 100% !important; }
    .pu-deckel { max-width: 100% !important; }
    .pu-pad { padding-left: 18px !important; padding-right: 18px !important; }
    .pu-h1 { font-size: 20px !important; }
    .pu-btn a { display: block !important; text-align: center !important; }
    .pu-btn-gap { width: 0 !important; height: 10px !important; display: block !important; }
    .pu-btn-cell { display: block !important; width: 100% !important; }
    .pu-meta-date { display: block !important; text-align: left !important; padding-top: 6px !important; }
  }
  /* Fremde Inhalte dürfen den Rahmen nicht sprengen. Steht NICHT in der
     Vorlage: dort ist der Inhalt selbst verfasst, hier stammt er von aussen. */
  .pu-inhalt img { max-width: 100% !important; height: auto !important; }
  .pu-inhalt table { max-width: 100% !important; }

  /**
   * ─── Fremde Mails wieder in die Mitte holen ─────────────────────────────
   *
   * Zwei Regeln, beide gegen denselben Trick.
   *
   * 1. Abstandszellen VERSTECKEN.
   *
   *    Newsletter setzen an schmalen Abstandszellen gern "display: block",
   *    damit sie auf dem Handy umbrechen. Instagram hat neun davon, und ihr
   *    Aufbau ist der eigentliche Grund fuer den Versatz:
   *
   *        <tr><td>INHALT</td><td width=16 display:block>…</td></tr>
   *        <tr><td width=16 display:block>…</td><td>INHALT</td></tr>
   *
   *    Die Zeilen wechseln sich ab. Zaehlt der Browser die Abstandszellen als
   *    echte Zellen, hat die Tabelle ZWEI Spalten, und jede wird so breit wie
   *    ihr breitester Inhalt — 443 px. Macht 886 px Tabellenbreite, und der
   *    Inhalt sitzt mal in der linken, mal in der rechten Spalte, daneben eine
   *    leere. Genau die ~900 px breite Karte mit der Luecke.
   *
   *    Mein erster Versuch stellte sie mit "display: table-cell" auf Zellen
   *    zurueck — das hat den Fehler erst vollstaendig erzeugt statt behoben.
   *    Richtig ist das Gegenteil: raus damit. Es sind 16-px-Abstandshalter,
   *    und unser Rahmen bringt seinen eigenen Rand mit.
   *
   *    Der Umbruch auf dem Handy geht verloren; in einem Leserahmen von
   *    720 px braucht ihn niemand.
   *
   * 2. Waagerecht mittig, egal was die Mail vorhat.
   *
   *    Eine Tabelle mit fester Breite in einer breiteren Flaeche klebt sonst
   *    links oder rechts — je nachdem, was der Absender angenommen hat. Bei
   *    einer Tabelle mit "width: 100%" ist die Regel wirkungslos, sie trifft
   *    also nur die Faelle, um die es geht.
   */
  /* Abstandszellen VERSTECKEN, nicht zu Zellen zurueckstellen.
     Begruendung unten — das table-cell davor war genau falsch herum. */
  .pu-inhalt td[style*="display:block"],
  .pu-inhalt td[style*="display: block"] { display: none !important; }
  /* Ausgleich fuers Verstecken: die Zelle NEBEN einer versteckten
     Abstandszelle bekommt deren 16 px als Innenabstand zurueck — sonst klebt
     die Schrift am Rand des Inhaltsblocks, genau das war zu sehen. Die
     0-px-Zellen (width:0) brauchen keinen Ausgleich, :not nimmt sie aus.
     :has() gibt es in Safari seit 16.4. Rasterzellen (Bildkacheln) haben
     keine display:block-Nachbarn und bleiben unberuehrt. */
  .pu-inhalt td[style*="display:block"]:not([style*="width:0"]) + td,
  .pu-inhalt td[style*="display: block"]:not([style*="width:0"]) + td { padding-left: 16px !important; }
  .pu-inhalt td:has(+ td[style*="display:block"]:not([style*="width:0"])),
  .pu-inhalt td:has(+ td[style*="display: block"]:not([style*="width:0"])) { padding-right: 16px !important; }
  .pu-inhalt table { margin-left: auto !important; margin-right: auto !important; }
  .pu-inhalt pre { white-space: pre-wrap !important; }
</style>
</head>
<body style="margin: 0; padding: 0; ${aussenStil}">

<div style="display: none; max-height: 0; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: ${RAHMEN_AUSSEN};">${esc(d.vorschautext)}${VORSCHAU_FUELLER}</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width: 100%; ${aussenStil}">
  <tr>
    <td align="center" style="padding: ${aussenAbstand};">

      <div class="pu-deckel" style="max-width: ${deckel}; margin: 0 auto;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${breiteAttr}" class="pu-shell" style="${breite} background: ${F.karte}; border: 1px solid ${F.rand};">

        ${kopfleiste}

        <tr>
          <td bgcolor="${esc(d.kategorieFarbe)}" height="3" style="background: ${esc(d.kategorieFarbe)}; height: 3px; line-height: 3px; font-size: 0;">&nbsp;</td>
        </tr>

        <tr>
          <td class="pu-pad" style="padding: 18px 24px; border-bottom: 1px solid ${F.randZart};">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width: 100%;">
              <tr>
                <td width="42" style="width: 42px; vertical-align: top;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="34" style="width: 34px;">
                    <tr>
                      <td bgcolor="${F.avatar}" align="center" height="34" style="width: 34px; height: 34px; background: ${F.avatar}; font-family: ${SANS}; font-size: 13px; font-weight: 700; color: ${F.avatarText}; mso-line-height-rule: exactly; line-height: 34px;">${esc(d.absenderInitialen)}</td>
                    </tr>
                  </table>
                </td>
                <td style="vertical-align: top;">
                  <div style="font-family: ${SANS}; font-size: 14px; font-weight: 700; color: ${F.titel}; mso-line-height-rule: exactly; line-height: 20px;">${esc(d.absenderName)}</div>
                  <div style="font-family: ${MONO}; font-size: 12px; color: ${F.leise}; mso-line-height-rule: exactly; line-height: 18px;">${esc(d.absenderAdresse)}</div>
                </td>
                <td align="right" class="pu-meta-date" style="font-family: ${MONO}; font-size: 12px; color: ${F.leise}; vertical-align: top; white-space: nowrap; mso-line-height-rule: exactly; line-height: 20px;">${esc(d.empfangenAm)}</td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td class="pu-pad" style="padding: 24px 24px 0;">
            <h1 class="pu-h1" style="margin: 0 0 14px; font-family: ${SANS}; font-size: 22px; line-height: 28px; mso-line-height-rule: exactly; font-weight: 700; letter-spacing: -0.01em; color: ${F.titel};">${esc(d.betreff)}</h1>${chips}
          </td>
        </tr>

        <tr>
          <td class="pu-pad pu-inhalt" style="padding: 18px 24px 0; font-family: ${SANS}; font-size: 15px; line-height: 25px; mso-line-height-rule: exactly; color: ${F.text};">
            ${d.inhaltHtml}${hervorhebung}
          </td>
        </tr>
${anhaenge}${aktionen}
        <tr>
          <td class="pu-pad" style="padding: 24px 24px 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width: 100%; border-top: 1px solid ${F.randZart};">
              <tr>
                <td style="padding-top: 14px; font-family: ${SANS}; font-size: 11px; line-height: 19px; mso-line-height-rule: exactly; color: ${F.leise};">
                  ${esc(d.fusszeileHerkunft)}<br>
                  <a href="mailto:info@partsunion.de" style="color: #1B6FE3; text-decoration: none;">info@partsunion.de</a> &middot; <a href="https://app.partsunion.de" style="color: #1B6FE3; text-decoration: none;">app.partsunion.de</a>${firmenzeile}${abmelden}
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
      </div>

    </td>
  </tr>
</table>

</body>
</html>`;
}
