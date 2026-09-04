/**
 * Outreach — Rundmails an ausgewählte Empfänger.
 *
 * Gegenstück zu Whatsapp-Bot/src/routes/outreachAdminRoutes.ts.
 *
 * Der Versand läuft im Backend NACHEINANDER durch die Empfängerliste, nicht
 * parallel — bei 200 Adressen dauert das entsprechend. Deshalb hat `senden`
 * hier eine eigene, grosszügige Zeitgrenze; die Vorgabe von 30 Sekunden würde
 * mitten im Versand abbrechen, und der Aufrufer wüsste nicht, wie weit er
 * gekommen ist.
 */

import { apiFetch } from './client';

export interface Empfaenger {
    email: string;
    firma: string;
    /** Hat sich abgemeldet — wird angezeigt, aber nie mitverschickt. */
    abgemeldet: boolean;
}

export interface Kampagne {
    id: string;
    betreff: string;
    absender: string;
    erstellt_von: string;
    erstellt_am: string;
    versendet_am: string | null;
    empfaenger_zahl: number;
    zugestellt_zahl: number;
    fehler_zahl: number;
}

export interface VersandErgebnis {
    kampagneId: string;
    zugestellt: number;
    fehlgeschlagen: number;
    /** Abgemeldete, die übersprungen wurden. */
    uebersprungen: number;
}

export async function ladeEmpfaenger(suche = ''): Promise<Empfaenger[]> {
    const pfad = suche.trim()
        ? `/api/admin/outreach/empfaenger?suche=${encodeURIComponent(suche.trim())}`
        : '/api/admin/outreach/empfaenger';
    const roh = await apiFetch<{ empfaenger?: Empfaenger[] }>(pfad);
    return roh.empfaenger ?? [];
}

export async function ladeKampagnen(): Promise<Kampagne[]> {
    const roh = await apiFetch<{ kampagnen?: Kampagne[] }>('/api/admin/outreach/kampagnen');
    return roh.kampagnen ?? [];
}

export async function sendeKampagne(daten: {
    betreff: string;
    html: string;
    text: string;
    absender: string;
    empfaenger: string[];
}): Promise<VersandErgebnis> {
    return apiFetch<VersandErgebnis>('/api/admin/outreach/senden', {
        method: 'POST',
        body: JSON.stringify(daten),
        headers: { 'Content-Type': 'application/json' },
        // Der Versand laeuft nacheinander; 30 Sekunden reichen dafuer nicht.
        timeoutMs: 5 * 60_000,
        // Ein abgebrochener Versand darf NICHT wiederholt werden — sonst
        // bekommen die ersten Empfaenger die Mail zweimal.
        maxRetries: 1,
    });
}

export async function abmelden(email: string, grund?: string): Promise<void> {
    await apiFetch('/api/admin/outreach/abmelden', {
        method: 'POST',
        body: JSON.stringify({ email, grund }),
        headers: { 'Content-Type': 'application/json' },
    });
}
