/**
 * Systemzustand für die Anzeige in der Seitenleiste.
 *
 * ─── Zwei Sackgassen, die ich beide selbst gebaut habe ────────────────────
 *
 * Hier stand zuerst `/health`. Das schlug fehl, und meine Diagnose war
 * richtig: Caddy schuetzt den Pfad mit einem Ops-Token und antwortet auf den
 * CORS-Vorabruf mit 401 ohne CORS-Kopfzeilen. Der Kommentar dazu steht in der
 * Caddyfile: die Detailauskunft verraet Datenbank- und Warteschlangen-Interna.
 *
 * Meine Korrektur war dann `/api/admin/health` — mit der Begruendung, die
 * Route liege im Backend bereit. Sie lag nie bereit. Ich hatte gemessen:
 *
 *     /health             Vorabruf 401
 *     /api/admin/health   Vorabruf 200
 *
 * und daraus geschlossen, die zweite Adresse existiere. Der Vorabruf sagt aber
 * nur, dass CORS fuer `/api/*` eingerichtet ist — er sagt NICHTS darueber, ob
 * dahinter eine Route liegt. Dasselbe gilt fuer eine 401-Antwort: die kommt
 * aus der Auth-Schicht, BEVOR ueberhaupt geroutet wird. Im gebauten Code
 * nachgesehen: `api/admin/health` kommt dort nicht vor. Die Ampeln standen
 * seit der "Korrektur" dauerhaft auf "Status wird geprueft", alle 15 Sekunden
 * ein 404 in der Konsole.
 *
 * ─── Was es wirklich gibt ────────────────────────────────────────────────
 *
 * `/health/live` ist in der Caddyfile ausdruecklich oeffentlich gestellt und
 * liefert `{"alive":true}` mit den passenden CORS-Kopfzeilen. Nachgemessen:
 * Status 200, `access-control-allow-origin: https://admin.partsunion.de`.
 *
 * Mehr ist von aussen NICHT feststellbar — und deshalb behauptet diese Datei
 * auch nicht mehr. Drei Einzelampeln fuer Datenbank, Redis und Warteschlange
 * aus einem blossen Lebenszeichen abzuleiten waere genau die Lampe ohne Kabel,
 * vor der der Kommentar in der Seitenleiste warnt.
 *
 * Wenn die Einzelampeln zurueck sollen, braucht es im Backend eine
 * authentifizierte Route, die sie liefert. Das ist keine Frontend-Aufgabe.
 */

import { apiFetch } from './client';

/** Was `/health/live` liefert. Mehr gibt der Endpunkt nicht her. */
interface Lebenszeichen {
    alive?: boolean;
}

export interface SystemZustand {
    /** Die API antwortet. Mehr ist von aussen nicht feststellbar. */
    erreichbar: boolean;
}

export async function getSystemHealth(): Promise<SystemZustand> {
    const roh = await apiFetch<Lebenszeichen>('/health/live');
    return { erreichbar: roh?.alive === true };
}
