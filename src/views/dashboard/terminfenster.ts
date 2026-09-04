/**
 * Der Zeitraum, den die Übersicht an Terminen zeigt — an EINER Stelle.
 *
 * Gebraucht wird er zweimal: die Übersicht holt damit ihre Termine, und das
 * Mailprogramm wärmt damit denselben Abruf vor, sobald der Zeiger den Rückweg
 * berührt.
 *
 * Warum das eine eigene Datei ist und nicht zweimal derselbe Dreizeiler:
 * React Query erkennt einen vorgewärmten Abruf am Schlüssel, nicht am Inhalt.
 * Berechnen beide Seiten den Zeitraum getrennt und läuft einer davon aus dem
 * Tritt, liegt trotzdem etwas in der Ablage — nur eben mit den falschen Daten
 * darin. Es bricht nichts, es ist nur wieder langsam, und das fällt niemandem
 * auf. Eine gemeinsame Quelle schliesst das aus.
 *
 * Der Zeitraum beginnt am MONTAG dieser Woche (nicht heute), damit der
 * Wochenstreifen vollständig ist, und reicht drei Wochen weit.
 */

export interface Terminfenster {
    from: string;
    to: string;
}

/**
 * Montag der Woche, in der `jetzt` liegt — auf Mitternacht gesetzt.
 *
 * Steht hier, weil der Wochenstreifen der Übersicht denselben Montag braucht
 * wie der Abruf. Zwei Rechnungen für dieselbe Kante gehen irgendwann
 * auseinander, und dann zeigt der Streifen eine Woche, für die gar keine
 * Termine geholt wurden.
 */
export function wochenStart(jetzt: Date = new Date()): Date {
    const montag = new Date(jetzt);
    montag.setHours(0, 0, 0, 0);
    // getDay(): Sonntag = 0. `+6 % 7` verschiebt den Wochenanfang auf Montag.
    montag.setDate(montag.getDate() - ((montag.getDay() + 6) % 7));
    return montag;
}

export function terminfenster(jetzt: Date = new Date()): Terminfenster {
    const von = wochenStart(jetzt);

    const bis = new Date(von);
    bis.setDate(von.getDate() + 21);

    return { from: von.toISOString(), to: bis.toISOString() };
}
