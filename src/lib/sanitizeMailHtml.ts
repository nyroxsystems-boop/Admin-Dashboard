/**
 * Bereinigung fremder E-Mail-HTML für die Anzeige im Postfach.
 *
 * Das ist die gefährlichste Fläche der ganzen Anwendung: Der Inhalt stammt von
 * beliebigen Fremden und wird einem angemeldeten Admin gerendert, der nebenan
 * Zugriff auf Kundendaten und Postfächer hat.
 *
 * ─── Warum das Ergebnis in einem abgeschotteten Rahmen landet ───────────────
 *
 * Die erste Fassung hat die bereinigte HTML direkt ins Dokument der Anwendung
 * gehängt. Damit musste die Bereinigung ALLES abfangen, was schaden könnte —
 * und war entsprechend grob: `style`-Attribute weg, Bilder weg, `<style>` weg.
 *
 * Bei einem echten Newsletter (Instagram: 50 Tabellen, 244 style-Attribute,
 * 14 Bilder) blieb davon eine senkrechte Linkliste mit leeren Kästchen übrig.
 * Ein Mailprogramm, das Post unleserlich macht, ist kaputt — auch wenn es
 * sicher ist.
 *
 * Die Darstellung läuft in einem iframe OHNE `allow-scripts`.
 * `allow-same-origin` ermöglicht die Größenmessung im Parent.
 * Eine eigene CSP in mailDocument.ts blockiert Netzwerkzugriffe standardmäßig.
 * Der Inhalt kann dort kein Skript
 * ausführen, das Dokument der Anwendung nicht sehen, keine Cookies und keinen
 * localStorage lesen. Diese Abschottung hängt an keiner Kopfzeile und wirkt
 * deshalb auch dann, wenn die Content-Security-Policy unterwegs ersetzt wird —
 * was hier tatsächlich passiert: der nginx im Container liefert eine strenge
 * Richtlinie, Caddy ersetzt sie durch eine ohne `script-src`.
 *
 * Weil die Abschottung trägt, darf die Mail ihr Aussehen behalten. Die
 * Bereinigung bleibt trotzdem — zwei Schichten sind Absicht, und `<script>`
 * und Konsorten haben auch im Rahmen nichts zu suchen.
 *
 * Dritte Schicht: Das Backend bereinigt beim Lesen ebenfalls
 * (inboxRoutes.ts, sanitizeInboundHtml).
 */
import DOMPurify from 'dompurify';

/**
 * Verbotene Elemente.
 *
 * `input`/`button`/`select`/`textarea`: `form` allein zu verbieten entfernt zwar
 * das Formular, lässt die Felder aber stehen. Im Lesebereich erschiene dann ein
 * täuschend echtes Passwortfeld. Absenden könnte es nichts, aber es ist die
 * halbe Miete für eine Fälschung.
 *
 * `img` steht bewusst NICHT hier — Bilder gehören zu einer Mail. Sie werden
 * stattdessen erst auf Knopfdruck geladen (siehe entferneExterneBilder).
 */
const VERBOTENE_TAGS = [
    'script', 'iframe', 'object', 'embed', 'applet',
    'form', 'input', 'button', 'select', 'textarea', 'option', 'label',
    'base', 'meta', 'link', 'style', 'video', 'audio', 'source', 'track',
];

/**
 * Verbotene Attribute.
 *
 * Alle `on*`-Ereignisse entfernt DOMPurify von sich aus. `style` steht hier
 * NICHT mehr: es trägt bei Newslettern das komplette Layout. DOMPurify ist
 * kein CSS-Sanitizer; Ressourcen in CSS entfernt mailDocument.ts zusätzlich.
 * Dessen CSP begrenzt die Netzwerkzugriffe unabhängig von der Bereinigung.
 */
const VERBOTENE_ATTRIBUTE = ['ping', 'formaction'];

let hookGesetzt = false;

/**
 * Sorgt dafür, dass JEDER Link in einer fremden Mail in einem neuen Tab landet
 * und die neue Seite nicht auf das Postfach zurückgreifen kann.
 *
 * Ohne das öffnet ein Link im SELBEN Tab: Wer in einer Mail auf "Rechnung
 * ansehen" klickt, dessen Mailprogramm wird durch die Seite des Absenders
 * ersetzt. In der installierten App gibt es dabei nicht einmal eine
 * Adresszeile, an der man den Wechsel bemerken würde.
 *
 * `noopener` nimmt der Zielseite den Zugriff auf `window.opener`, `noreferrer`
 * verschweigt die Herkunft.
 */
function hookEinrichten(): void {
    if (hookGesetzt) return;
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
        if (node.nodeName === 'A' && node instanceof Element) {
            const ziel = node.getAttribute('href') || '';
            if (ziel && !ziel.startsWith('#')) {
                node.setAttribute('target', '_blank');
                node.setAttribute('rel', 'noopener noreferrer nofollow');
            }
        }
    });
    hookGesetzt = true;
}

/** Bereinigt E-Mail-HTML. Gibt immer eine Zeichenkette zurück. */
/**
 * Entfernt Zählpixel — Bilder von 1x1 (oder 2x2) Pixeln mit fremder Adresse.
 *
 * Die haben keinen Inhalt. Ihr einziger Zweck ist, dem Absender zu melden, WANN
 * und WO die Mail geöffnet wurde. Der Newsletter, an dem das aufgefallen ist,
 * trug eines von `newstracking.yqservice.eu`.
 *
 * Sie werden ENDGÜLTIG entfernt, nicht nur zurückgehalten: auch nach „Bilder
 * anzeigen" bleiben sie weg. Wer die Bilder eines Newsletters sehen will, will
 * damit nicht auch eine Lesebestätigung verschicken — und der Inhalt verliert
 * nichts, weil dort nichts ist.
 *
 * Läuft in sanitizeMailHtml und damit IMMER, unabhängig davon, ob Bilder gerade
 * zurückgehalten werden.
 */
function zaehlpixelEntfernen(html: string): string {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    let entfernt = 0;
    for (const bild of Array.from(doc.querySelectorAll('img'))) {
        const src = bild.getAttribute('src') || '';
        if (!src || src.startsWith('data:')) continue;
        const zahl = (w: string | null) => {
            const n = Number.parseInt(w ?? '', 10);
            return Number.isFinite(n) ? n : null;
        };
        // Masse auch aus dem style-Attribut ("width:1px"). Nur px zaehlt:
        // Prozent oder em sind relativ und beschreiben kein festes Winzigbild.
        const stilMass = (wert: string) => {
            const m = /^(\d+(?:\.\d+)?)px$/i.exec(wert.trim());
            return m ? Number.parseFloat(m[1]) : null;
        };
        const b = zahl(bild.getAttribute('width')) ?? stilMass(bild.style.width);
        const h = zahl(bild.getAttribute('height')) ?? stilMass(bild.style.height);
        // Beide Masse müssen erklärt UND winzig sein — als Attribut ODER im
        // style: Facebook/Instagram deklarieren ihr email_open_log_pic nur per
        // style="width:1px;height:1px", ganz ohne Attribute, und ueberlebte so
        // die Entfernung. Ohne jede Angabe wird weiter nichts entfernt: ein
        // Bild ohne Masse kann echter Inhalt sein.
        if (b !== null && h !== null && b <= 2 && h <= 2) {
            bild.remove();
            entfernt += 1;
        }
    }
    return entfernt > 0 ? doc.body.innerHTML : html;
}

export function sanitizeMailHtml(roh: string | null | undefined): string {
    if (!roh) return '';
    hookEinrichten();
    return zaehlpixelEntfernen(DOMPurify.sanitize(roh, {
        USE_PROFILES: { html: true },
        FORBID_TAGS: VERBOTENE_TAGS,
        FORBID_ATTR: VERBOTENE_ATTRIBUTE,
        // Für Mail-Layout nötig, vom HTML-Profil nicht abgedeckt.
        //
        // `<style>`-BLOECKE ueberleben NICHT — DOMPurify entfernt sie in jeder
        // Konfiguration, auch mit ADD_TAGS. Das ist verkraftbar und entspricht
        // dem, was Gmail seit jeher tut: Das Layout eines Newsletters haengt an
        // den Inline-Stilen, nicht am Stylesheet. Bei der Instagram-Mail stehen
        // 244 style-Attribute genau einem <style>-Block gegenueber.
        ADD_ATTR: ['target', 'rel', 'background', 'bgcolor', 'valign', 'align'],
    }));
}

